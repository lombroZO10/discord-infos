import axios from 'axios';

export class XatBlogAPI {
    /**
     * Initializes XatBlogAPI client.
     */
    constructor() {
        this.baseUrl = 'https://api.xatblog.net/';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    /**
     * Sends a GET request to the specified API path.
     * @param {string} path API endpoint path.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async sendRequest (path) {
        try {
            const response = await this.client.get(path);
            return response.data || { error: 'Failed to decode JSON response' };
        } catch (error) {
            return { error: 'Failed to send request' };
        }
    }

    /**
     * Gets the latest blog posts.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async latest () {
        return await this.sendRequest('latest');
    }

    /**
     * Gets power prices.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async prices () {
        return await this.sendRequest('prices');
    }

    /**
     * Gets the countdown info.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async countdown () {
        return await this.sendRequest('countdown');
    }

    /**
     * Gets promoted chats.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async promoted () {
        return await this.sendRequest('promoted');
    }

    /**
     * Gets active pawns.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async activePawns () {
        return await this.sendRequest('activepawns');
    }

    /**
     * Converts regname to ID.
     * @param {string} username Regname to convert.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async regToId (username) {
        return await this.sendRequest(`reg2id/${username}`);
    }

    /**
     * Converts ID to regname.
     * @param {number|string} id ID to convert.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async idToReg (id) {
        return await this.sendRequest(`id2reg/${id}`);
    }

    /**
     * Gets name price.
     * @param {string} username Username to check.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async namePrice (username) {
        return await this.sendRequest(`nameprice/${username}`);
    }

    /**
     * Gets chat price.
     * @param {string} chatname Chat name to check.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async chatPrice (chatname) {
        return await this.sendRequest(`chatprice/${chatname}`);
    }

    /**
     * Gets chat info.
     * @param {string} chatname Chat name to check.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async chatInfo (chatname) {
        return await this.sendRequest(`chatinfo/${chatname}`);
    }

    /**
     * Searches for a power.
     * @param {string} powername Power name to search.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async powerSearch (powername) {
        return await this.sendRequest(`powersearch/${powername}`);
    }

    /**
     * Gets power info.
     * @param {string} powername Power name to check.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async powerInfo (powername) {
        return await this.sendRequest(`powerinfo/${powername}`);
    }

    /**
     * Gets power logs.
     * @param {string} powername Power name to check.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async powerLogs (powername) {
        return await this.sendRequest(`powerlogs/${powername}`);
    }

    /**
     * Gets promo price.
     * @param {number} hours Number of hours.
     * @param {string} [language] Language code (default 'en').
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async promoPrice (hours, language = 'en') {
        return await this.sendRequest(`promoprice/${hours}/${language}`);
    }

    /**
     * Converts days to xats.
     * @param {number} amount Number of days.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async daysToXats (amount) {
        return await this.sendRequest(`dx/${amount}`);
    }

    /**
     * Converts xats to days.
     * @param {number} amount Number of xats.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async xatsToDays (amount) {
        return await this.sendRequest(`x2d/${amount}`);
    }

    /**
     * Verifies a banner URL.
     * @param {string} url Banner URL to verify.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async verifyBanner (url) {
        return await this.sendRequest(`verifybanner/${url}`);
    }

    /**
     * Gets user gifts.
     * @param {string|number} userOrId User regname or ID.
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async userGifts (userOrId) {
        return await this.sendRequest(`usergifts/${userOrId}`);
    }

    /**
     * Gets jinx list.
     * @param {string|null} [powername] Power name (optional).
     * @return {Promise<Object>} Decoded JSON response or error object.
     */
    async jinxList (powername = null) {
        return await this.sendRequest(powername ? `jinxlist/${powername}` : 'jinxlist');
    }
}