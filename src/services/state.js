export class BotState {
    constructor() {
        this.ws = null;
        this.isLoggingIn = false;
        this.isConnected = false;
        this.chatInfo = {};
        this.badwords = {};
        this.loginInfo = {};
        this.settings = {};
        this.usersFlood = {};
        this.users = new Map();
        this.userKicks = new Map();
        this.lastMessageUserId = null;
        this.lastMessageTimestamp = 0;
        this.envData = {
            username: process.env.BOT_USER,
            apiKey: process.env.BOT_APIKEY,
            chat: process.env.BOT_CHAT,
            nick: process.env.BOT_NICK?.trim() || null,
            avatar: process.env.BOT_AVATAR?.trim() || null,
            home: process.env.BOT_HOME?.trim(),
            language: process.env.CHAT_LANGUAGE,
            websocketUrl: process.env.WEBSOCKET_URL,
            websocketOrigin: process.env.WEBSOCKET_ORIGIN,
            disabledPowers: JSON.parse(process.env.DISABLED_POWERS),
            discord: {
                token: process.env.DISCORD_BOT_TOKEN?.trim() || null,
                channelId: process.env.DISCORD_CHANNEL_ID?.trim() || null,
                ownerId: process.env.DISCORD_OWNER_ID?.trim() || null,
                activity: process.env.DISCORD_ACTIVITY?.trim() || "xat.com",
                configFile: process.env.DISCORD_CONFIG_FILE?.trim()
                    || "./data/discord-monitor.json",
            },
        };
    }

    /**
     * Adds or updates a user in the users map.
     * @param {number} id User ID to add.
     * @param {User} user User instance to add.
     */
    addUser(id, user) {
        this.users.set(id, user);
    }

    /**
     * Increments kick count for a user and returns the new count.
     * @param {number} userId
     * @return {number}
     */
    incrementKick(userId) {
        const kicks = (this.userKicks.get(userId) || 0) + 1;
        this.userKicks.set(userId, kicks);
        return kicks;
    }

    /**
     * Gets the current kick count for a user.
     * @param {number} userId
     * @return {number}
     */
    getKicks(userId) {
        return this.userKicks.get(userId) || 0;
    }

    /**
     * Resets the kick count for a user.
     * @param {number} userId
     */
    resetKicks(userId) {
        this.userKicks.set(userId, 0);
    }

    /**
     * Removes a user from the users map by ID.
     * @param {number} userId User ID to remove.
     */
    removeUser(userId) {
        this.users.delete(userId);
    }

    /**
     * Gets a user by ID from the users map.
     * @param {number} userId User ID to retrieve.
     * @return {User|undefined}
     */
    getUser(userId) {
        return this.users.get(userId);
    }
}
