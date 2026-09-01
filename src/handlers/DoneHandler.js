export default {
    name: 'done', // Packet name

    /**
     * Connected to chat
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
    */
    async execute (bot, packet) {
        bot.state.isConnected = true;
        void bot.discordBridge.reportXatStatus(
            "connected",
            `Conectado e monitorando a sala ${bot.state.envData.chat}.`
        );
    }
}
