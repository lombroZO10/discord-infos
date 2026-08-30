import { EmbedBuilder, escapeMarkdown } from "discord.js";
import { discordColorValue } from "./DiscordColor.js";

const COMMAND_NAME = "onlines";
const DELETE_AFTER_MS = 60_000;
const DESCRIPTION_LIMIT = 3_800;

const visibleName = (user) => (
    user.nickname || user.regname || `Usuário ${user.userId}`
);

const sortName = (user) => visibleName(user)
    .normalize("NFKD")
    .replace(/\p{M}|\p{Cf}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const buildList = (users) => {
    if (!users.length) return "*Nenhuma pessoa online no momento.*";

    const lines = [];
    let hidden = 0;

    for (const [index, user] of users.entries()) {
        const line = `\`${String(index + 1).padStart(2, "0")}\`  ${escapeMarkdown(visibleName(user))}`;
        if ([...lines, line].join("\n").length > DESCRIPTION_LIMIT) {
            hidden = users.length - index;
            break;
        }
        lines.push(line);
    }

    if (hidden) lines.push(`\n*… e mais ${hidden} pessoa${hidden === 1 ? "" : "s"}.*`);
    return lines.join("\n");
};

export class DiscordOnlineCommand {
    constructor({ getUsers, getColor, logger, schedule = setTimeout }) {
        this.getUsers = getUsers;
        this.getColor = getColor;
        this.logger = logger;
        this.schedule = schedule;
    }

    definition() {
        return {
            name: COMMAND_NAME,
            description: "Mostra quem está online no xat por 1 minuto",
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
        if (!interaction.isChatInputCommand?.() || interaction.commandName !== COMMAND_NAME) {
            return false;
        }

        const users = [...(this.getUsers?.() || [])]
            .sort((first, second) => sortName(first).localeCompare(
                sortName(second),
                "pt-BR",
                { sensitivity: "base" }
            ));
        const embed = new EmbedBuilder()
            .setColor(discordColorValue(this.getColor?.()))
            .setAuthor({ name: "REΛLEZA  •  PRESENÇA AO VIVO" })
            .setTitle(`👥 Online no xat  •  ${users.length}`)
            .setDescription(buildList(users))
            .setFooter({ text: "Esta lista será apagada automaticamente em 1 minuto" })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });

        const timer = this.schedule(() => {
            void interaction.deleteReply().catch((error) => {
                this.logger.warn(`[discord] Não foi possível apagar /onlines: ${error.message}`);
            });
        }, DELETE_AFTER_MS);
        timer?.unref?.();
        return true;
    }
}
