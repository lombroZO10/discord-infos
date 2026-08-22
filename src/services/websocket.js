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
        await bot.send("y", {
            r: room > 0 ? room : bot.state.chatInfo.id,
            v: 0,
            u: bot.state.loginInfo.i || 2,
        });
    });

    //  Websocket got a message
    ws.on("message", async (data) => {
        try {
            bot.logger.info(`<< ${data}`);
            const packets = xmlToArray(data.toString());
            for (const [type, packet] of packets) {
                await bot.packetHandler.handle(type, packet);
            }
        } catch (error) {
            bot.logger.error(`Packet error: ${error.message} - ${error.stack}`);
        }
    });

    // Websocket got closed
    ws.on("close", () => {
        bot.logger.info("Connection closed");
        bot.state.isConnected = false;
    });

    // Websocket got an error
    ws.on("error", (error) => {
        bot.logger.error(`WebSocket error: ${error.message} - ${error.stack}`);
        bot.state.isConnected = false;
    });

    return ws;
}
