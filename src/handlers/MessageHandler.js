import { parseUser } from "../utils/helpers.js";
import { parseXatReply } from "../services/DiscordTextFormatter.js";

export default {
    name: "m", // Packet name

    /**
     * Messages
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
     */
    async execute (bot, packet) {
        if (packet.s === "1" || packet.t[0] === "/") return;

        const userID = parseUser(packet.u);
        const message = packet.t.trim();

        if (!message) return;

        const user = bot.state.getUser(userID);
        const reply = parseXatReply(message);
        const quotedMessage = reply
            ? bot.state.findQuotedMessage?.(reply.quotedText)
            : null;
        const relayedMessage = {
            userId: userID.toString(),
            nickname: user?.getNick(),
            regname: user?.getRegname(),
            text: reply?.replyText || message,
            ...(reply ? {
                replyTo: {
                    referenceId: reply.referenceId,
                    text: reply.quotedText,
                    userId: quotedMessage?.userId || null,
                    nickname: quotedMessage?.nickname || null,
                    regname: quotedMessage?.regname || null,
                },
            } : {}),
        };

        void bot.discordBridge?.relayXatMessage(relayedMessage);
        bot.state.rememberMessage?.({
            userId: relayedMessage.userId,
            nickname: relayedMessage.nickname,
            regname: relayedMessage.regname,
            text: message,
        });
    },
};
