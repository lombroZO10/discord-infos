import { parseUser } from "../utils/helpers.js";

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
        void bot.discordBridge?.relayXatMessage({
            userId: userID.toString(),
            nickname: user?.getNick(),
            regname: user?.getRegname(),
            text: message,
        });

        if (bot.state.settings.modFilters)
            await bot.moderationFilters(userID, message);
    },
};
