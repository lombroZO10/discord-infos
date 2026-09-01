import { writeFile } from 'fs/promises';

export default {
    name: 'logout', // Packet name

    /**
     * Got an error
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
    */
    async execute (bot, packet) {
        const error = packet.e.toLowerCase();

        if (['e03', 'e16', 'f011', 'e43', 'e45'].includes(error)) {
            if (error === 'e45') {
                bot.logger.error('You are temporary banned from xat. Please, try again later.');
                await bot.discordBridge.reportOperationalLog(
                    "error",
                    "Conta temporariamente bloqueada",
                    "O xat retornou o código E45. O processo será encerrado.",
                    "xat"
                );
                process.exit(1);
            }
            void bot.discordBridge.reportXatStatus(
                "reconnecting",
                `Sessão encerrada pelo xat (${packet.e}); tentando conectar novamente.`
            );
            return await bot.connect();
        }

        bot.logger.error(`xat Error: ${packet.e}. Please try again.`);
        void bot.discordBridge.reportOperationalLog(
            "error",
            "Erro retornado pelo xat",
            `Código retornado: ${packet.e}`,
            "xat"
        );

        await writeFile('./cache/login.json', '{}');
    }
}
