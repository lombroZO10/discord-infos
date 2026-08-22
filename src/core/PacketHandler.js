import Handlers from "../handlers/_all.js"

export class PacketHandler {
    /**
     * Creates a PacketHandler instance.
     * @param {Object} bot Bot instance.
     */
    constructor(bot) {
        this.bot = bot;
        this.handlers = new Map();
    }

    /**
     * Initializes the packet handler by loading all handlers.
     * @return {Promise<void>}
     */
    async init () {
        for (const handler of Handlers) {
            const { name, execute } = handler;
            if (name && typeof execute === 'function') {
                this.handlers.set(name.toLowerCase(), handler);
            }
        }
    }

    /**
     * Handles a packet by type.
     * @param {string} type Packet type name.
     * @param {Object} packet Packet data.
     * @return {Promise<void>}
     */
    async handle (type, packet) {
        const handlerName = type.toLowerCase();
        if (this.handlers.has(handlerName)) {
            await this.handlers.get(handlerName).execute(this.bot, packet);
        }
    }
}
