export default {
    name: "char", // Command name

    /**
     * Executes the command.
     * @param {Bot} bot - Bot instance
     * @param {string} xatID - User ID
     * @param {string} message - Message
     * @param {string} from - Source (main, pc, pm)
     */
    async execute (bot, xatID, message, from) {
        if (!bot.hasPermission(xatID, from)) return;

        if (!message) {
            return await bot.reply(
                `The current command char is: ${bot.state.settings.char}`, 
                xatID, 
                from
            );
        }

        await bot.updateDb({ char: message });

        await bot.reply(
            `Char updated to: ${message}`, 
            xatID, 
            from
        );
    },
};
