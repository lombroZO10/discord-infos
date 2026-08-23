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

const matchSummary = (matches) => [
    matches.keywords.length
        ? `🔑 **Palavras-chave:** ${matches.keywords.map((entry) => escapeMarkdown(entry)).join(", ")}`
        : null,
    matches.nicknames.length
        ? `👤 **Nicks monitorados:** ${matches.nicknames.map((entry) => escapeMarkdown(entry)).join(", ")}`
        : null,
].filter(Boolean).join("\n");

export class DiscordBridge {
    constructor(config, logger, client = null, store = null) {
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
    }

    async start() {
        const { token, channelId, ownerId, activity } = this.config;

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
        try {
            await this.store.load();
        } catch (error) {
            this.logger.error(
                `[discord] Configuração do monitor inválida; usando listas vazias: ${error.message}`
            );
        }
        this.startActivityRotation(activity);

        if (validOwnerId) {
            this.panel = new DiscordControlPanel({
                client: this.client,
                channel,
                ownerId: validOwnerId,
                store: this.store,
                logger: this.logger,
            });
            this.client.on(Events.InteractionCreate, (interaction) => {
                void this.panel?.handleInteraction(interaction).catch((error) => {
                    this.logger.error(`[discord] Falha no painel: ${error.message}`);
                });
            });
            try {
                await this.panel.start();
            } catch (error) {
                this.logger.error(`[discord] Não foi possível publicar o painel: ${error.message}`);
            }
        } else if (!ownerId) {
            this.logger.warn(
                "[discord] DISCORD_OWNER_ID ausente; painel e alertas privados desativados."
            );
        }

        this.logger.info(`[discord] Conectado como ${this.client.user.tag}.`);
        return true;
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
            const safeText = escapeMarkdown(discordText).slice(0, 3_900);
            const color = this.store.snapshot?.().color;
            const embed = new EmbedBuilder()
                .setColor(discordColorValue(color))
                .setAuthor({ name: "XAT SENTINEL  •  ALERTA PRIVADO" })
                .setTitle("🚨 Atividade monitorada detectada")
                .setThumbnail(`attachment://${LOGO_NAME}`)
                .setDescription(
                    "Uma regra configurada foi acionada no xat.\n\n"
                    + `>>> ${safeText}`
                )
                .addFields(
                    {
                        name: "👤 Identidade",
                        value: `**${displayName}**\n\`ID ${message.userId || "desconhecido"}\``,
                        inline: true,
                    },
                    {
                        name: "🎯 Motivo do alerta",
                        value: matchSummary(matches).slice(0, 1_024),
                        inline: true,
                    }
                )
                .setFooter({ text: "Alerta confidencial • XAT Sentinel" })
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
            return false;
        }
    }

    stop() {
        if (this.activityTimer) clearInterval(this.activityTimer);
        this.activityTimer = null;
        this.channel = null;
        this.ownerUser = null;
        this.panel = null;
        this.client?.destroy();
    }
}
