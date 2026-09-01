import { writeFile } from 'fs/promises';

export default {
    name: 'v', // Packet name

    /**
     * Login, relogin and errors
     * @param {object} bot - Bot instance
     * @param {object} packet - Packet data
    */
    async execute (bot, packet) {
        if (packet.e) {
            if ([21, 36].includes(parseInt(packet.e))) {
                void bot.discordBridge.reportXatStatus(
                    "reconnecting",
                    `A autenticação pediu uma nova conexão (código ${packet.e}).`
                );
                return await bot.connect();
            }

            bot.logger.error(`Login error: ${packet.e}. Please try again.`);
            void bot.discordBridge.reportOperationalLog(
                "error",
                "Erro de login no xat",
                `Código retornado: ${packet.e}`,
                "Autenticação xat"
            );

            await writeFile('./cache/login.json', '{}'); // Clear login info

            return;
        }

        if (packet.n) {
            await writeFile('./cache/login.json', JSON.stringify(packet)); // Save login info

            bot.state.loginInfo = packet;

            if (bot.state.isLoggingIn) {
                bot.state.isLoggingIn = false;
                bot.restart("Login renovado; entrando novamente na sala.");
            }
        }
    }
}
