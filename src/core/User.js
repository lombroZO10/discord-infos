export class User {
    /**
     * Creates a User instance from a packet.
     * @param {Object} packet Raw user packet.
     */
    constructor(packet) {
        this.id = packet.u ?? 0;
        this.regname = packet.N ?? null;
        this.nick = packet.n ?? null;
        this.avatar = packet.a ?? null;
        this.home = packet.h ?? null;
        this.bride = packet.d2 ?? 0;
        this.app = packet.x ?? 0;
        this.gameban = packet.w ?? 0;
        this.wasHere = !!packet.s;
        this.flag0 = packet.f ?? 0;
        this.aflags = packet.d0 ?? 0;
        this.qflags = packet.q ?? 0;
        this.login = packet.cb ?? 0;
        this.rev = packet.v ?? 0;
    }

    /**
     * Gets the user ID.
     * @return {number}
     */
    getID () {
        return this.id;
    }

    /**
     * Gets the regname.
     * @return {string|null}
     */
    getRegname () {
        return this.regname;
    }

    /**
     * Gets the avatar URL.
     * @return {string|null}
     */
    getAvatar () {
        return this.avatar;
    }

    /**
     * Gets the home URL.
     * @return {string|null}
     */
    getHome () {
        return this.home;
    }

    /**
     * Gets the bride ID.
     * @return {number}
     */
    getBride () {
        return this.bride;
    }

    /**
     * Gets the gameban value.
     * @return {number}
     */
    getGameban () {
        return this.gameban;
    }

    /**
     * Gets the login timestamp.
     * @return {number}
     */
    getLoginTimestamp () {
        return this.login;
    }

    /**
     * Gets the flag0 value.
     * @return {number}
     */
    getFlag () {
        return this.flag0;
    }

    /**
     * Gets the rev value.
     * @return {number}
     */
    getRev () {
        return this.rev;
    }

    /**
     * Gets the user's nickname (without status/glow/hat tags).
     * @return {string}
     */
    getNick () {
        if (!this.nick) return '';
        let nick = this.nick;
        const pos = nick.indexOf('##');
        if (pos !== -1) nick = nick.substring(0, pos);
        nick = nick.replace(/\(glow[^)]+\)|\(hat[^)]+\)/g, '');
        return nick;
    }

    /**
     * Gets the user's status message (after ##).
     * @return {string}
     */
    getStatus () {
        if (!this.nick) return '';
        const idx = this.nick.indexOf('##');
        return idx !== -1 ? this.nick.substring(idx + 2) : '';
    }

    /**
     * Gets the status glow (color code in status).
     * @return {string}
     */
    getStatusglow () {
        const status = this.getStatus();
        const idx = status.indexOf('#');
        return idx !== -1 ? status.substring(idx) : '';
    }

    /**
     * Gets the name glow (color code in nickname).
     * @return {string}
     */
    getNameglow () {
        const nick = this.getNick();
        const idx = nick.indexOf('#');
        return idx !== -1 ? nick.substring(idx) : '';
    }

    /**
     * Gets the user's rank (0=guest, 1=main, 2=mod, 3=member, 4=owner).
     * @return {number}
     */
    getRank () {
        return this.flag0 & 7;
    }

    /**
     * Checks if the user is on xat.
     * @return {boolean}
     */
    onXat () {
        return (this.qflags & 1) !== 0;
    }

    /**
     * Checks if the user has gifts.
     * @return {boolean}
     */
    hasGifts () {
        return (this.aflags & (1 << 24)) !== 0;
    }

    /**
     * Checks if the user was here.
     * @return {boolean}
     */
    hasBeenHere () {
        return this.wasHere;
    }

    /**
     * Checks if the user is gamebanned.
     * @return {boolean}
     */
    isGamebanned () {
        return ![176, 184, 0].includes(this.gameban);
    }

    /**
     * Checks if the user is a guest.
     * @return {boolean}
     */
    isGuest () {
        return this.getRank() === 0;
    }

    /**
     * Checks if the user is a main owner.
     * @return {boolean}
     */
    isMain () {
        return this.getRank() === 1;
    }

    /**
     * Checks if the user is an owner.
     * @return {boolean}
     */
    isOwner () {
        return this.getRank() === 4;
    }

    /**
     * Checks if the user is a moderator.
     * @return {boolean}
     */
    isMod () {
        return this.getRank() === 2;
    }

    /**
     * Checks if the user is a member.
     * @return {boolean}
     */
    isMember () {
        return this.getRank() === 3;
    }

    /**
     * Checks if the user is banned.
     * @return {boolean}
     */
    isBanned () {
        return (this.flag0 & (1 << 4)) !== 0;
    }

    /**
     * Checks if the user has days.
     * @return {boolean}
     */
    hasDays () {
        return ((this.flag0 & (1 << 5)) !== 0) || ((this.qflags & 2) !== 0);
    }

    /**
     * Checks if the user is forever.
     * @return {boolean}
     */
    isForever () {
        return (this.flag0 & (1 << 6)) !== 0;
    }

    /**
     * Checks if the user is registered.
     * @return {boolean}
     */
    isRegistered () {
        return !!this.regname;
    }

    /**
     * Checks if the user is gagged.
     * @return {boolean}
     */
    isGagged () {
        return (this.flag0 & (1 << 8)) !== 0;
    }

    /**
     * Checks if the user is in sin bin.
     * @return {boolean}
     */
    isSinBin () {
        return (this.flag0 & (1 << 9)) !== 0;
    }

    /**
     * Checks if the user is invisible.
     * @return {boolean}
     */
    isInvisible () {
        return (this.flag0 & (1 << 10)) !== 0;
    }

    /**
     * Checks if the user is bannished.
     * @return {boolean}
     */
    isBannished () {
        return (this.flag0 & (1 << 12)) !== 0;
    }

    /**
     * Checks if the user is a bot.
     * @return {boolean}
     */
    isBot () {
        return (this.flag0 & (1 << 13)) !== 0;
    }

    /**
     * Checks if the user is away.
     * @return {boolean}
     */
    isAway () {
        return (this.flag0 & (1 << 14)) !== 0;
    }

    /**
     * Checks if the user is dunced.
     * @return {boolean}
     */
    isDunced () {
        return (this.flag0 & (1 << 15)) !== 0;
    }

    /**
     * Checks if the user is typing.
     * @return {boolean}
     */
    isTyping () {
        return (this.flag0 & (1 << 16)) !== 0;
    }

    /**
     * Checks if the user is zipped.
     * @return {boolean}
     */
    isZipped () {
        return (this.flag0 & (1 << 17)) !== 0;
    }

    /**
     * Checks if the user is reverse banned.
     * @return {boolean}
     */
    isReverseBanned () {
        return (this.flag0 & (1 << 17)) !== 0;
    }

    /**
     * Checks if the user is badged.
     * @return {boolean}
     */
    isBadged () {
        return (this.flag0 & (1 << 18)) !== 0;
    }

    /**
     * Checks if the user is naughty.
     * @return {boolean}
     */
    isNaughty () {
        return (this.flag0 & (1 << 19)) !== 0;
    }

    /**
     * Checks if the user is yellow carded.
     * @return {boolean}
     */
    isYellowCarded () {
        return (this.flag0 & (1 << 20)) !== 0;
    }

    /**
     * Checks if the user is BFF.
     * @return {boolean}
     */
    isBFF () {
        return (this.aflags & 1) !== 0;
    }

    /**
    * Checks if the user is married.
    * @return {boolean}
    */
    isMarried () {
        return this.getBride() !== 0;
    }

    /**
     * Checks if the user is red carded.
     * @return {boolean}
     */
    isRedCarded () {
        return (this.aflags & (1 << 21)) !== 0;
    }

    /**
     * Checks if the user is celebrity.
     * @return {boolean}
     */
    isCelebrity () {
        return (this.aflags & (1 << 71)) !== 0;
    }

    /**
     * Checks if the user is verified (influencer).
     * @return {boolean}
     */
    isVerified () {
        return (this.aflags & (1 << 11)) !== 0;
    }
}
