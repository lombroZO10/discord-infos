import { parseUser } from '../utils/helpers.js';

export default {
    name: 'z', // Packet name

    /**
     * When someone tickles you
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
    */
    async execute (bot, packet) {
        const uid = parseUser(packet.u);

        if (!bot.state.getUser(uid)) return;

        await bot.send('z', {
            d: uid,
            u: bot.state.loginInfo.i,
            t: '/aon'
        });
    }
}