export default {
    name: 'dup', // Packet name

    /**
     * Duplicate connection
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
    */
    async execute (bot, packet) {
        bot.logger.error('DUP');
        await bot.discordBridge.reportOperationalLog(
            "error",
            "Conexão duplicada",
            "O xat detectou outra sessão usando a mesma conta. O processo será encerrado.",
            "xat"
        );
        process.exit(1);
    }
}
