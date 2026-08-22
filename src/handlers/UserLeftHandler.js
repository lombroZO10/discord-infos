import { parseUser } from '../utils/helpers.js';

export default {
    name: 'l', // Packet name

    /**
     * Someone left chat
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
    */
    async execute (bot, packet) {
        const userId = parseUser(packet.u);
        if (userId >= 1900000000) return;

        // Remove user from cache
        bot.state.removeUser(userId);
    }
}