import { promises as fs } from "fs";
import { setupLogger } from "../services/logger.js";
import { DiscordBridge } from "../services/DiscordBridge.js";
import { BotState } from "../services/state.js";
import { WebSocketData } from "../services/websocket.js";
import { XatBlogAPI } from "../api/XatBlogAPI.js";
import { sanitize, runIfConnected } from "../utils/helpers.js";
import { PacketHandler } from "./PacketHandler.js";
import { Settings } from "../models/Settings.js";

export class Bot {
    /**
     * Initializes the bot instance, handlers and WebSocket.
     */
    constructor() {
        this.logger = setupLogger();
        this.state = new BotState();

        this.xatBlogAPI = new XatBlogAPI();
        this.discordBridge = new DiscordBridge(
            {
                ...this.state.envData.discord,
                chatName: this.state.envData.chat,
            },
            this.logger,
            null,
            null,
            () => this.state.getOnlineUsers()
        );

        this.packetHandler = new PacketHandler(this);

        this.init();
    }

    /**
     * Initializes the bot, loads settings, logs in,
     * and connects to the chat server.
     */
    async init () {
        try {
            await this.getFromDb();

            if (!this.state.settings) {
                await Settings.create({ id: 1 });
                await this.getFromDb();
            }

            await this.getChatInfo();
            await this.packetHandler.init();

            void this.discordBridge.start().catch((error) => {
                this.logger.error(`[discord] Falha ao iniciar: ${error.message}`);
                this.discordBridge.stop();
            });

            try {
                const data = await fs.readFile('./badwords.json', 'utf-8');
                const allBadwords = JSON.parse(data);
                const lang = (this.state.envData.language || 'en').toLowerCase();
                if (lang === 'all') {
                    const merged = Object.values(allBadwords).flat();
                    this.state.badwords = Array.from(new Set(merged.map(w => (w || '').trim().toLowerCase()).filter(Boolean)));
                } else {
                    this.state.badwords = allBadwords[lang] || allBadwords['en'] || [];
                }
            } catch (e) { }

            await this.login();
            await this.connect();
            await this.keepRunning();
        } catch (error) {
            this.logger.error(`Init error: ${error.message} - ${error.stack}`);
            await this.discordBridge.reportOperationalLog(
                "error",
                "Falha crítica na inicialização",
                error.message,
                "Processo"
            );
            process.exit(1);
        }
    }

    /**
     * Log in to xat.
     */
    async login () {
        var loginData;

        try {
            loginData = JSON.parse(await fs.readFile("./cache/login.json", "utf-8"));
        } catch { }

        if (loginData?.i === undefined) {
            this.state.isLoggingIn = true;
        } else {
            this.state.loginInfo = loginData;
        }
    }

    /**
     * Establishes a WebSocket connection.
     * @param {number} room - Chat ID
     */
    async connect (room = 0) {
        void this.discordBridge.reportXatStatus(
            "connecting",
            room > 0 ? "Abrindo conexão de autenticação." : "Abrindo conexão com a sala configurada."
        );
        this.state.ws = WebSocketData(this, room);
    }

    /**
     * Sends a packet to xat.
     * @param {string} name - Packet name
     * @param {object} data - Packet data
     */
    async send (name, data) {
        if (!this.state.ws) return;

        try {
            let packet = `<${name} `;

            for (const [key, value] of Object.entries(data)) {
                if (value !== false) {
                    packet += `${key}="${sanitize(value.toString())}" `;
                }
            }
            packet += packet.endsWith(" ") ? "/>" : " />";
            this.logger.info(`>> <${name} />`);
            this.state.ws.send(packet + "\x00");
        } catch (error) {
            this.logger.error(`Send error: ${error.message} - ${error.stack}`);
            void this.discordBridge.reportOperationalLog(
                "error",
                "Falha ao enviar pacote técnico",
                error.message,
                "xat WebSocket"
            );
        }
    }

    /**
     * Retrieves about the current chat.
     */
    async getChatInfo () {
        const data = await this.xatBlogAPI.chatInfo(this.state.envData.chat);
        if (!data?.chat?.id) {
            this.logger.error("Chat not found");
            await this.discordBridge.reportOperationalLog(
                "error",
                "Sala do xat não encontrada",
                `Não foi possível localizar a sala configurada: ${this.state.envData.chat}`,
                "Inicialização"
            );
            process.exit(1);
        }
        this.state.chatInfo = data.chat;
    }

    /**
     * Restart xat bot.
     */
    async restart (reason = "Reconexão solicitada pelo servidor.") {
        void this.discordBridge.reportXatStatus("reconnecting", reason);
        await this.send("C", {});
        this.state.isConnected = false;
        this.state.ws.terminate();
        this.connect();
    }

    /**
     * Force the bot to relogin.
     */
    async relogin () {
        await this.send("v", {
            n: this.state.loginInfo.i,
            p: 0,
        });
    }

    /**
     * Load data from settings.
     */
    async getFromDb () {
        this.state.settings = await Settings.findOne({
            where: { id: 1 }
        });
    }

    /**
     * Keeps the bot running and run tasks.
     */
    async keepRunning () {
        runIfConnected(() => this.state.ws.ping(), this, 30000);
        runIfConnected(() => this.send("ping", []), this, 60000);
        runIfConnected(() => this.send("c", {
            u: this.state.loginInfo.i,
            t: "/KEEPALIVE",
        }), this, 900000);
    }

}
