import Commands from "../commands/_all.js"

export class CommandHandler {
    /**
     * Creates a CommandHandler instance.
     * @param {Object} bot Bot instance.
     */
    constructor(bot) {
        this.bot = bot;
        this.commands = new Map();
    }

    /**
     * Initializes the command handler by loading all commands.
     * @return {Promise<void>}
     */
    async init () {
        for (const command of Commands) {
            const { name, execute } = command;
            if (name && typeof execute === 'function') {
                this.commands.set(name.toLowerCase(), command);
            }
        }
        this.bot.commands = this.commands;
    }

    /**
     * Handles a command message.
     * @param {string} text Command message (e.g. "/cmd args").
     * @param {number|string} xatID User ID.
     * @param {string} [from] Source (default 'main').
     * @return {Promise<void>}
     */
    async handle (text, xatID, from = 'main') {
        const [cmd, ...args] = text.split(' ');
        const commandName = cmd.slice(1).toLowerCase();
        if (this.commands.has(commandName)) {
            await this.commands.get(commandName).execute(this.bot, xatID, args.join(' '), from);
        }
    }
}

