import { EmbedBuilder } from "discord.js";

const COLORS = Object.freeze({
    info: 0x5865F2,
    success: 0x23A55A,
    warning: 0xF0B232,
    error: 0xF23F43,
});

const ICONS = Object.freeze({
    info: "🔵",
    success: "🟢",
    warning: "🟡",
    error: "🔴",
});

const safeText = (value, limit = 1_000) => String(value || "Sem detalhes")
    .replace(/`/g, "ˋ")
    .slice(0, limit);

const connectionLabel = (state) => ({
    connected: "🟢 Conectado",
    connecting: "🟡 Conectando",
    reconnecting: "🟠 Reconectando",
    disconnected: "🔴 Desconectado",
    error: "🔴 Com erro",
    disabled: "⚫ Desativado",
}[state] || "⚪ Aguardando");

export class DiscordStatusMonitor {
    constructor({ logger, chatName, heartbeatMs = 300_000 } = {}) {
        this.logger = logger;
        this.chatName = chatName || "não informado";
        this.heartbeatMs = heartbeatMs;
        this.channel = null;
        this.dashboardMessage = null;
        this.queue = Promise.resolve();
        this.pending = [];
        this.heartbeatTimer = null;
        this.startedAt = Date.now();
        this.reconnections = 0;
        this.state = {
            discord: "connecting",
            xat: "connecting",
            xatLastSignalAt: null,
            lastEvent: "Inicializando o processo",
            updatedAt: new Date(),
        };
    }

    async attach(channel, botTag) {
        this.channel = channel;
        this.state.discord = "connected";
        this.state.lastEvent = `Discord conectado como ${botTag}`;
        this.state.updatedAt = new Date();

        await this.enqueue(async () => {
            this.dashboardMessage = await this.channel.send(this.dashboardPayload());
        });
        await this.event("success", "Monitoramento iniciado", "Canal operacional conectado e recebendo eventos.", "Discord");

        for (const event of this.pending.splice(0)) {
            await this.event(...event);
        }

        this.heartbeatTimer = setInterval(() => {
            void this.refresh();
        }, this.heartbeatMs);
        this.heartbeatTimer.unref?.();
    }

    setDiscord(state, detail) {
        this.state.discord = state;
        return this.event(
            state === "connected" ? "success" : state === "error" ? "error" : "warning",
            `Discord ${connectionLabel(state).replace(/^\S+\s/, "")}`,
            detail,
            "Discord"
        );
    }

    setXat(state, detail) {
        if (state === "reconnecting") this.reconnections += 1;
        this.state.xat = state;
        if (state === "connected") this.state.xatLastSignalAt = new Date();
        return this.event(
            state === "connected" ? "success" : state === "error" ? "error" : "warning",
            `xat ${connectionLabel(state).replace(/^\S+\s/, "")}`,
            detail,
            "xat"
        );
    }

    log(level, title, detail, component = "Sistema") {
        return this.event(level, title, detail, component);
    }

    touchXat() {
        this.state.xatLastSignalAt = new Date();
    }

    event(level, title, detail, component) {
        const normalizedLevel = COLORS[level] ? level : "info";
        const event = [normalizedLevel, title, detail, component];
        this.state.lastEvent = `${component}: ${title}`;
        this.state.updatedAt = new Date();

        if (!this.channel) {
            this.pending.push(event);
            if (this.pending.length > 25) this.pending.shift();
            return Promise.resolve(false);
        }

        return this.enqueue(async () => {
            const embed = new EmbedBuilder()
                .setColor(COLORS[normalizedLevel])
                .setAuthor({ name: "REΛLEZA  •  LOG OPERACIONAL" })
                .setTitle(`${ICONS[normalizedLevel]} ${safeText(title, 220)}`)
                .setDescription(safeText(detail, 3_500))
                .addFields({ name: "Componente", value: safeText(component, 100), inline: true })
                .setTimestamp();

            await this.channel.send({
                embeds: [embed],
                allowedMentions: { parse: [] },
            });
            await this.refreshNow();
            return true;
        });
    }

    dashboardPayload() {
        const uptimeSeconds = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1_000));
        const hours = Math.floor(uptimeSeconds / 3_600);
        const minutes = Math.floor((uptimeSeconds % 3_600) / 60);
        const xatSignalAge = this.state.xatLastSignalAt
            ? Date.now() - this.state.xatLastSignalAt.getTime()
            : Number.POSITIVE_INFINITY;
        const xatResponsive = this.state.xat === "connected" && xatSignalAge < 120_000;
        const healthy = this.state.discord === "connected" && xatResponsive;
        const xatSignal = this.state.xatLastSignalAt
            ? `<t:${Math.floor(this.state.xatLastSignalAt.getTime() / 1_000)}:R>`
            : "Ainda não recebido";

        const embed = new EmbedBuilder()
            .setColor(healthy ? COLORS.success : COLORS.warning)
            .setAuthor({ name: "REΛLEZA  •  CENTRAL DE STATUS" })
            .setTitle(healthy ? "🟢 Operação normal" : "🛡️ Monitorando conexões")
            .setDescription("Visão atual da ponte passiva xat → Discord.")
            .addFields(
                { name: "Discord", value: connectionLabel(this.state.discord), inline: true },
                { name: "xat", value: connectionLabel(this.state.xat), inline: true },
                { name: "Sala monitorada", value: `\`${safeText(this.chatName, 100)}\``, inline: true },
                { name: "Tempo ativo", value: `${hours}h ${minutes}min`, inline: true },
                { name: "Reconexões xat", value: String(this.reconnections), inline: true },
                {
                    name: "Último sinal xat",
                    value: xatResponsive ? xatSignal : `⚠️ ${xatSignal}`,
                    inline: true,
                },
                { name: "Último evento", value: safeText(this.state.lastEvent, 1_024), inline: false },
            )
            .setFooter({ text: "Atualização automática a cada 5 minutos e em cada evento" })
            .setTimestamp();

        return { embeds: [embed], allowedMentions: { parse: [] } };
    }

    refresh() {
        if (!this.channel || !this.dashboardMessage) return Promise.resolve(false);
        return this.enqueue(() => this.refreshNow());
    }

    async refreshNow() {
        if (!this.dashboardMessage) return false;
        await this.dashboardMessage.edit(this.dashboardPayload());
        return true;
    }

    enqueue(task) {
        const run = this.queue.then(task);
        this.queue = run.catch((error) => {
            this.logger?.error(`[discord-status] Falha ao publicar status: ${error.message}`);
            return false;
        });
        return run.catch(() => false);
    }

    stop() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.channel = null;
        this.dashboardMessage = null;
    }
}
