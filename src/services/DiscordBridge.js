import {
    ActivityType,
    Client,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    escapeMarkdown,
} from "discord.js";
import { DiscordControlPanel } from "./DiscordControlPanel.js";
import { DiscordMonitorStore } from "./DiscordMonitorStore.js";

const DISCORD_MESSAGE_LIMIT = 2_000;
const DISCORD_ID_PATTERN = /^\d{17,20}$/;

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
        this.client.user.setPresence({
            activities: [{
                name: activity,
                type: ActivityType.Watching,
            }],
            status: "online",
        });

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

    relayXatMessage(message) {
        if (!this.channel) return Promise.resolve(false);

        const displayName = message.nickname || message.regname || message.userId;
        const header = `**${escapeMarkdown(displayName)}** \`(${message.userId})\``;
        const availableLength = Math.max(
            0,
            DISCORD_MESSAGE_LIMIT - header.length - 1
        );
        const text = message.text.slice(0, availableLength);
        const matches = this.store.match(message);

        this.queue = this.queue
            .then(async () => {
                let delivered = false;
                try {
                    await this.channel?.send({
                        content: `${header}\n${text}`,
                        allowedMentions: { parse: [] },
                    });
                    delivered = true;
                } catch (error) {
                    this.logger.error(
                        `[discord] Falha ao encaminhar mensagem: ${error.message}`
                    );
                }

                if (matches.matched) await this.sendAlert(message, matches);
                return delivered;
            });

        return this.queue;
    }

    async sendAlert(message, matches) {
        if (!this.config.ownerId) return false;

        try {
            this.ownerUser ||= await this.client.users.fetch(this.config.ownerId);
            const displayName = message.nickname || message.regname || message.userId;
            const reasons = [
                matches.keywords.length
                    ? `Palavras: ${matches.keywords.join(", ")}`
                    : null,
                matches.nicknames.length
                    ? `Nicks: ${matches.nicknames.join(", ")}`
                    : null,
            ].filter(Boolean).join("\n");
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("Alerta de monitoramento do xat")
                .addFields(
                    {
                        name: "Usuário",
                        value: `${escapeMarkdown(displayName)} (${message.userId})`.slice(0, 1_024),
                    },
                    {
                        name: "Correspondência",
                        value: escapeMarkdown(reasons).slice(0, 1_024),
                    },
                    {
                        name: "Mensagem",
                        value: message.text.slice(0, 1_024),
                    }
                )
                .setTimestamp();

            await this.ownerUser.send({
                embeds: [embed],
                allowedMentions: { parse: [] },
            });
            return true;
        } catch (error) {
            this.logger.error(`[discord] Falha ao enviar alerta privado: ${error.message}`);
            return false;
        }
    }

    stop() {
        this.channel = null;
        this.ownerUser = null;
        this.panel = null;
        this.client?.destroy();
    }
}
