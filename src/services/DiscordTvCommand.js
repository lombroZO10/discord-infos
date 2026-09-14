import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    escapeMarkdown,
} from "discord.js";
import { discordColorValue } from "./DiscordColor.js";
import { formatXatTextForDiscord } from "./DiscordTextFormatter.js";

const COMMAND_NAME = "tv";
const STOP_PREFIX = "tv:stop:";
const ONLINE_BUTTON_ID = "tv:online";
const REFRESH_MS = 4_000;
// Discord invalida o token de uma interação após 15 minutos; paramos antes disso.
const MAX_DURATION_MS = 14 * 60_000;
const MESSAGE_COUNT = 30;
// A descrição do embed tem um limite próprio de 4.096 caracteres na API do
// Discord; deixamos uma margem de segurança para o resto do embed.
const DESCRIPTION_LIMIT = 3_900;
const ONLINE_COLUMNS = 3;
const COLUMN_LIMIT = 950;

const visibleName = (user) => (
    user.nickname || user.regname || `Usuário ${user.userId}`
);

const sortName = (user) => visibleName(user)
    .normalize("NFKD")
    .replace(/\p{M}|\p{Cf}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Splits the online list into side-by-side inline columns instead of a
 * single wrapping paragraph, closer to how xat itself lists who's present.
 */
const onlineColumns = (users) => {
    if (!users.length) {
        return [{
            name: `👥 Online agora  •  0`,
            value: "*Sala vazia no momento.*",
            inline: true,
        }];
    }

    const names = [...users]
        .sort((first, second) => sortName(first).localeCompare(
            sortName(second),
            "pt-BR",
            { sensitivity: "base" }
        ))
        .map((user) => escapeMarkdown(visibleName(user)));

    const perColumn = Math.ceil(names.length / ONLINE_COLUMNS);
    const columns = [];
    for (let start = 0; start < names.length; start += perColumn) {
        columns.push(names.slice(start, start + perColumn));
    }

    return columns.map((column, index) => {
        const lines = [];
        let hidden = 0;
        for (const [lineIndex, name] of column.entries()) {
            if ([...lines, name].join("\n").length > COLUMN_LIMIT) {
                hidden = column.length - lineIndex;
                break;
            }
            lines.push(name);
        }
        if (hidden) lines.push(`*+ ${hidden}*`);

        return {
            name: index === 0 ? `👥 Online agora  •  ${users.length}` : "​",
            value: lines.join("\n") || "​",
            inline: true,
        };
    });
};

/**
 * Renders a single feed line. xat's HTML5 reply notation is already resolved
 * into `replyTo` by state.getRecentMessages(), so it becomes a readable
 * quote instead of the raw `❯#id[...]` markup.
 */
const feedLine = (message) => {
    const author = escapeMarkdown(message.nickname || message.regname || "Alguém");
    const text = escapeMarkdown(formatXatTextForDiscord(message.text)).slice(0, 400);

    if (message.replyTo?.text) {
        const quotedAuthor = message.replyTo.nickname || message.replyTo.regname;
        const quotedLabel = quotedAuthor ? escapeMarkdown(quotedAuthor) : "mensagem citada";
        const quotedText = escapeMarkdown(formatXatTextForDiscord(message.replyTo.text)).slice(0, 150);
        return `↩️ *em resposta a **${quotedLabel}**: "${quotedText}"*\n**${author}:** ${text}`;
    }

    return `**${author}:** ${text}`;
};

const chatFeed = (messages) => {
    if (!messages.length) return "*Nenhuma mensagem pública recente.*";

    const lines = messages.slice(-MESSAGE_COUNT).map(feedLine);

    while (lines.length > 1 && lines.join("\n").length > DESCRIPTION_LIMIT) {
        lines.shift();
    }
    return lines.join("\n").slice(0, DESCRIPTION_LIMIT);
};

export class DiscordTvCommand {
    constructor({
        getUsers,
        getMessages,
        getColor,
        chatName,
        logger,
        schedule = setInterval,
        clearSchedule = clearInterval,
    }) {
        this.getUsers = getUsers || (() => []);
        this.getMessages = getMessages || (() => []);
        this.getColor = getColor;
        this.chatName = chatName || "sala configurada";
        this.logger = logger;
        this.schedule = schedule;
        this.clearSchedule = clearSchedule;
        this.sessions = new Map();
    }

    definition() {
        return {
            name: COMMAND_NAME,
            description: "Mostra a sala do xat ao vivo, em tempo real",
        };
    }

    async register(manager) {
        if (!manager) return false;

        const commands = await manager.fetch();
        const existing = [...commands.values()]
            .find((command) => command.name === COMMAND_NAME);
        const definition = this.definition();

        if (existing) await existing.edit(definition);
        else await manager.create(definition);
        return true;
    }

    async handle(interaction) {
        if (interaction.isChatInputCommand?.() && interaction.commandName === COMMAND_NAME) {
            await this.start(interaction);
            return true;
        }
        if (interaction.isButton?.() && interaction.customId === ONLINE_BUTTON_ID) {
            await this.showOnline(interaction);
            return true;
        }
        if (interaction.isButton?.() && interaction.customId?.startsWith(STOP_PREFIX)) {
            await this.stopFromButton(interaction);
            return true;
        }
        return false;
    }

    async showOnline(interaction) {
        const users = this.getUsers() || [];
        const embed = new EmbedBuilder()
            .setColor(discordColorValue(this.getColor?.()))
            .setAuthor({ name: "REΛLEZA  •  PRESENÇA AO VIVO" })
            .setTitle(`👥 Online no xat  •  ${users.length}`)
            .addFields(...onlineColumns(users))
            .setTimestamp();

        try {
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            this.logger?.warn(`[discord] Não foi possível mostrar os onlines da TV: ${error.message}`);
        }
    }

    payload(remainingMs) {
        const users = this.getUsers() || [];
        const minutesLeft = Math.max(1, Math.ceil(remainingMs / 60_000));

        const embed = new EmbedBuilder()
            .setColor(discordColorValue(this.getColor?.()))
            .setAuthor({ name: "REΛLEZA  •  TV AO VIVO" })
            .setTitle(`📺 ${escapeMarkdown(this.chatName)}`)
            .setDescription(chatFeed(this.getMessages() || []))
            .setFooter({
                text: `👥 ${users.length} online • Atualiza a cada ${REFRESH_MS / 1_000}s`
                    + ` • Encerra em até ${minutesLeft} min`,
            })
            .setTimestamp();

        return { embeds: [embed] };
    }

    async start(interaction) {
        const sessionId = interaction.id;
        const startedAt = Date.now();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(ONLINE_BUTTON_ID)
                .setLabel("Mostrar online")
                .setEmoji("👥")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${STOP_PREFIX}${sessionId}`)
                .setLabel("Parar transmissão")
                .setEmoji("⏹️")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            ...this.payload(MAX_DURATION_MS),
            components: [buttons],
            allowedMentions: { parse: [] },
        });

        const timer = this.schedule(() => {
            void this.tick(sessionId);
        }, REFRESH_MS);
        timer?.unref?.();

        this.sessions.set(sessionId, {
            timer,
            interaction,
            startedAt,
            ownerId: interaction.user.id,
        });
    }

    async tick(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const remaining = MAX_DURATION_MS - (Date.now() - session.startedAt);
        if (remaining <= 0) {
            await this.end(
                sessionId,
                "⏹️ **Transmissão encerrada automaticamente.** Use `/tv` novamente para continuar assistindo."
            );
            return;
        }

        try {
            await session.interaction.editReply({
                ...this.payload(remaining),
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            this.logger?.warn(`[discord] Não foi possível atualizar a TV ao vivo: ${error.message}`);
            this.clearSession(sessionId);
        }
    }

    async stopFromButton(interaction) {
        const sessionId = interaction.customId.slice(STOP_PREFIX.length);
        const session = this.sessions.get(sessionId);

        if (session && session.ownerId !== interaction.user.id) {
            await interaction.reply({
                content: "Somente quem iniciou a transmissão pode encerrá-la.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        this.clearSession(sessionId);
        try {
            await interaction.update({
                content: "⏹️ **Transmissão da TV ao vivo encerrada.**",
                embeds: [],
                components: [],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            this.logger?.warn(`[discord] Não foi possível encerrar a TV ao vivo: ${error.message}`);
        }
    }

    async end(sessionId, content) {
        const session = this.sessions.get(sessionId);
        this.clearSession(sessionId);
        if (!session) return;

        try {
            await session.interaction.editReply({
                content,
                embeds: [],
                components: [],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            this.logger?.warn(`[discord] Não foi possível encerrar a TV ao vivo: ${error.message}`);
        }
    }

    clearSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) this.clearSchedule(session.timer);
        this.sessions.delete(sessionId);
    }

    stop() {
        for (const sessionId of [...this.sessions.keys()]) this.clearSession(sessionId);
    }
}
