import { WebSocket } from "ws";
import { xmlToArray } from "../utils/helpers.js";

export function WebSocketData(bot, room = 0) {
    if (bot.state.isConnected) return;
    if (bot.state.isLoggingIn) room = 3;

    const ws = new WebSocket(bot.state.envData.websocketUrl, {
        headers: {
            "Origin": bot.state.envData.websocketOrigin,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });

    // Websocket is connected
    ws.on("open", async () => {
        bot.state.isConnected = true;
        bot.state.ws = ws;
        void bot.discordBridge.reportXatStatus(
            "connecting",
            "Socket aberto; autenticando a sessão na sala."
        );
        await bot.send("y", {
            r: room > 0 ? room : bot.state.chatInfo.id,
            v: 0,
            u: bot.state.loginInfo.i || 2,
        });
    });

    //  Websocket got a message
    ws.on("message", async (data) => {
        bot.discordBridge.confirmXatActivity();
        try {
            const packets = xmlToArray(data.toString());
            bot.logger.info(`<< ${packets.map(([type]) => type).join(", ")}`);
            for (const [type, packet] of packets) {
                await bot.packetHandler.handle(type, packet);
            }
        } catch (error) {
            bot.logger.error(`Packet error: ${error.message} - ${error.stack}`);
            void bot.discordBridge.reportOperationalLog(
                "error",
                "Falha ao processar dados recebidos",
                error.message,
                "xat WebSocket"
            );
        }
    });

    // A pong confirms that the xat socket is still responsive without posting a new log.
    ws.on("pong", () => {
        bot.discordBridge.confirmXatActivity();
    });

    // Websocket got closed
    ws.on("close", (code, reason) => {
        bot.logger.info("Connection closed");
        bot.state.isConnected = false;
        const reasonText = reason?.toString()?.trim();
        void bot.discordBridge.reportXatStatus(
            "disconnected",
            `Conexão encerrada (código ${code})${reasonText ? `: ${reasonText}` : "."}`
        );
    });

    // Websocket got an error
    ws.on("error", (error) => {
        bot.logger.error(`WebSocket error: ${error.message} - ${error.stack}`);
        bot.state.isConnected = false;
        void bot.discordBridge.reportXatStatus("error", error.message);
    });

    return ws;
}
