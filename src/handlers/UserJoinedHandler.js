import { parseUser } from "../utils/helpers.js";
import { User } from "../core/User.js";

export default {
    name: "u", // Packet name

    /**
     * Someone joined chat
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
     */
    async execute(bot, packet) {
        const userId = parseUser(packet.u);
        if (userId >= 1900000000) return;

        // Add user to cache
        const user = new User(packet);
        bot.state.addUser(userId, user);

    },
};
