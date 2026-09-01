import {
    ActivityType,
    AttachmentBuilder,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    escapeMarkdown,
} from "discord.js";
import { fileURLToPath } from "node:url";
import { DiscordControlPanel } from "./DiscordControlPanel.js";
import { DiscordMonitorStore } from "./DiscordMonitorStore.js";
import { discordColorValue } from "./DiscordColor.js";
import { formatXatTextForDiscord } from "./DiscordTextFormatter.js";
import { DiscordOnlineCommand } from "./DiscordOnlineCommand.js";
import { DiscordStatusMonitor } from "./DiscordStatusMonitor.js";

const DISCORD_ID_PATTERN = /^\d{17,20}$/;
const LOGO_NAME = "realeza-logo.png";
const LOGO_PATH = fileURLToPath(new URL("../../assets/realeza-logo.png", import.meta.url));
const DEFAULT_ACTIVITIES = Object.freeze([
    "o império crescer",
    "as oportunidades surgirem",
    "o dinheiro trabalhar",
]);

const displayNameFor = (message) => (
    message.nickname || message.regname || message.userId || "Usuário desconhecido"
);

const detectedRule = (matches) => {
    if (matches.keywords.length) {
        return matches.keywords
            .map((entry) => `**${escapeMarkdown(entry)}**`)
            .join(" • ");
    }

    return `Nick monitorado: **${matches.nicknames
        .map((entry) => escapeMarkdown(entry))
        .join(", ")}**`;
};

export class DiscordBridge {
    constructor(config, logger, client = null, store = null, getOnlineUsers = null) {
        this.config = config;
        this.logger = logger;
        this.channel = null;
        this.ownerUser = null;
        this.panel = null;
        this.queue = Promise.resolve();
        this.client = client;
        this.store = store || new DiscordMonitorStore(config.configFile);
        this.activityTimer = null;
        this.lastActivity = null;
        this.onlineCommand = new DiscordOnlineCommand({
            getUsers: getOnlineUsers || (() => []),
            getColor: () => this.store.snapshot?.().color,
            logger,
        });
        this.statusMonitor = new DiscordStatusMonitor({
            logger,
            chatName: config.chatName,
        });
    }

    async start() {
        const { token, channelId, statusChannelId, ownerId, activity } = this.config;

        if (!token && !channelId) {
            this.logger.warn("[discord] Ponte desativada: token e canal não configurados.");
            return false;
        }

        if (!token || !channelId) {
            throw new Error("DISCORD_BOT_TOKEN e DISCORD_CHANNEL_ID devem ser configurados juntos.");
        }

        if (!DISCORD_ID_PATTERN.test(channelId)) {
            throw new Error("DISCORD_CHANNEL_ID deve conter um ID válido.");
        }
        const validOwnerId = ownerId && DISCORD_ID_PATTERN.test(ownerId)
            ? ownerId
            : null;
        this.config.ownerId = validOwnerId;
        if (ownerId && !validOwnerId) {
            this.logger.error(
                "[discord] DISCORD_OWNER_ID inválido; painel e alertas privados desativados."
            );
        }

        this.client ||= new Client({
            intents: [GatewayIntentBits.Guilds],
        });
        this.client.on(Events.Error, (error) => {
            this.logger.error(`[discord] Erro do cliente: ${error.message}`);
            void this.statusMonitor.setDiscord("error", error.message);
        });
        this.client.on(Events.Warn, (warning) => {
            this.logger.warn(`[discord] Aviso do cliente: ${warning}`);
            void this.statusMonitor.log("warning", "Aviso do cliente Discord", warning, "Discord");
        });
        this.client.on(Events.ShardReconnecting, (shardId) => {
            void this.statusMonitor.setDiscord(
                "reconnecting",
                `Gateway reconectando (shard ${shardId}).`
            );
        });
        this.client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
            void this.statusMonitor.setDiscord(
                "disconnected",
                `Gateway desconectado (shard ${shardId}, código ${closeEvent?.code || "desconhecido"}).`
            );
        });
        this.client.on(Events.ShardResume, (shardId, replayedEvents) => {
            void this.statusMonitor.setDiscord(
                "connected",
                `Gateway restabelecido (shard ${shardId}, ${replayedEvents} eventos recuperados).`
            );
        });

        const ready = new Promise((resolve) => {
            this.client.once(Events.ClientReady, resolve);
        });

        await this.client.login(token);
        await ready;

        const channel = await this.client.channels.fetch(channelId);
        if (!channel?.isSendable()) {
            throw new Error(`O canal ${channelId} não existe ou não aceita mensagens.`);
        }

        this.channel = channel;
        if (statusChannelId) {
            if (statusChannelId === channelId) {
                this.logger.error(
                    "[discord] DISCORD_STATUS_CHANNEL_ID deve ser diferente de DISCORD_CHANNEL_ID."
                );
            } else if (!DISCORD_ID_PATTERN.test(statusChannelId)) {
                this.logger.error("[discord] DISCORD_STATUS_CHANNEL_ID deve conter um ID válido.");
            } else {
                try {
                    const statusChannel = await this.client.channels.fetch(statusChannelId);
                    if (!statusChannel?.isSendable()) {
                        throw new Error(`O canal ${statusChannelId} não existe ou não aceita mensagens.`);
                    }
                    await this.statusMonitor.attach(statusChannel, this.client.user.tag);
                } catch (error) {
                    this.logger.error(`[discord] Canal de status indisponível: ${error.message}`);
                }
            }
        } else {
            this.logger.warn("[discord] DISCORD_STATUS_CHANNEL_ID ausente; logs em tempo real desativados.");
        }
        try {
            await this.store.load();
        } catch (error) {
            this.logger.error(
                `[discord] Configuração do monitor inválida; usando listas vazias: ${error.message}`
            );
            void this.statusMonitor.log(
                "error",
                "Configuração do monitor inválida",
                error.message,
                "Discord"
            );
        }
        this.startActivityRotation(activity);
        this.client.on(Events.InteractionCreate, (interaction) => {
            void this.handleInteraction(interaction).catch((error) => {
                this.logger.error(`[discord] Falha na interação: ${error.message}`);
                void this.statusMonitor.log(
                    "error",
                    "Falha ao processar interação",
                    error.message,
                    "Discord"
                );
            });
        });

        try {
            const commandManager = channel.guild?.commands || this.client.application?.commands;
            await this.onlineCommand.register(commandManager);
        } catch (error) {
            this.logger.error(`[discord] Não foi possível registrar /onlines: ${error.message}`);
            void this.statusMonitor.log(
                "error",
                "Falha ao registrar /onlines",
                error.message,
                "Discord"
            );
        }

        if (validOwnerId) {
            this.panel = new DiscordControlPanel({
                client: this.client,
                channel,
                ownerId: validOwnerId,
                store: this.store,
                logger: this.logger,
            });
            try {
                await this.panel.start();
            } catch (error) {
                this.logger.error(`[discord] Não foi possível publicar o painel: ${error.message}`);
                void this.statusMonitor.log(
                    "error",
                    "Falha ao publicar painel",
                    error.message,
                    "Discord"
                );
            }
        } else if (!ownerId) {
            this.logger.warn(
                "[discord] DISCORD_OWNER_ID ausente; painel e alertas privados desativados."
            );
        }

        this.logger.info(`[discord] Conectado como ${this.client.user.tag}.`);
        return true;
    }

    reportXatStatus(state, detail) {
        return this.statusMonitor.setXat(state, detail);
    }

    reportOperationalLog(level, title, detail, component) {
        return this.statusMonitor.log(level, title, detail, component);
    }

    confirmXatActivity() {
        this.statusMonitor.touchXat();
    }

    async handleInteraction(interaction) {
        if (await this.onlineCommand.handle(interaction)) return;
        await this.panel?.handleInteraction(interaction);
    }

    startActivityRotation(configuredActivity) {
        const configured = String(configuredActivity || "").trim();
        const activities = configured && configured.toLocaleLowerCase() !== "xat.com"
            ? configured.split("|").map((entry) => entry.trim()).filter(Boolean)
            : [...DEFAULT_ACTIVITIES];

        const update = () => {
            const choices = activities.filter((entry) => entry !== this.lastActivity);
            const pool = choices.length ? choices : activities;
            const activity = pool[Math.floor(Math.random() * pool.length)];
            this.lastActivity = activity;
            this.client.user.setPresence({
                activities: [{ name: activity, type: ActivityType.Watching }],
                status: "online",
            });
        };

        update();
        this.activityTimer = setInterval(update, 60_000);
        this.activityTimer.unref?.();
    }

    relayXatMessage(message) {
        if (!this.channel) return Promise.resolve(false);

        const matches = this.store.match(message);
        if (!matches.matched) return Promise.resolve(false);

        this.queue = this.queue
            .then(async () => {
                return this.sendAlert(message, matches);
            });

        return this.queue;
    }

    async sendAlert(message, matches) {
        if (!this.config.ownerId) return false;

        try {
            this.ownerUser ||= await this.client.users.fetch(this.config.ownerId);
            const displayName = escapeMarkdown(displayNameFor(message));
            const discordText = formatXatTextForDiscord(message.text);
            const safeText = escapeMarkdown(discordText).slice(0, 3_500);
            const color = this.store.snapshot?.().color;
            const embed = new EmbedBuilder()
                .setColor(discordColorValue(color))
                .setAuthor({ name: "REΛLEZA  •  ALERTA PRIVADO" })
                .setTitle(`👤 ${displayName}`.slice(0, 256))
                .setThumbnail(`attachment://${LOGO_NAME}`)
                .setDescription(`>>> ${safeText}`)
                .addFields(
                    {
                        name: matches.keywords.length > 1
                            ? "🎯 Palavras citadas"
                            : matches.keywords.length === 1
                                ? "🎯 Palavra citada"
                                : "🎯 Gatilho",
                        value: detectedRule(matches).slice(0, 1_024),
                    }
                )
                .setFooter({ text: "REΛLEZA • monitoramento confidencial" })
                .setTimestamp();

            await this.ownerUser.send({
                embeds: [embed],
                files: [
                    new AttachmentBuilder(LOGO_PATH).setName(LOGO_NAME),
                ],
                allowedMentions: { parse: [] },
            });
            return true;
        } catch (error) {
            this.logger.error(`[discord] Falha ao enviar alerta privado: ${error.message}`);
            void this.statusMonitor.log(
                "error",
                "Falha ao enviar alerta privado",
                error.message,
                "Discord"
            );
            return false;
        }
    }

    stop() {
        if (this.activityTimer) clearInterval(this.activityTimer);
        this.activityTimer = null;
        this.channel = null;
        this.ownerUser = null;
        this.panel = null;
        this.statusMonitor.stop();
        this.client?.destroy();
    }
}
