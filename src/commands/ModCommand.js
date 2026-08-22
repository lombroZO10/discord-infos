export default {
    name: 'mod', // Command name

    options: {
        maxkicks: { key: 'maxKicks', type: 'number' },
        bantime: { key: 'banDurationHours', type: 'number' },
        capslockmax: { key: 'capsLockMax', type: 'number' },
        linesmax: { key: 'linesMax', type: 'number' },
        maxletters: { key: 'maxLetters', type: 'number' },
        maxsmilies: { key: 'maxSmilies', type: 'number' },
        capslockdetect: { key: 'capsLockDetect', type: 'toggle' },
        flooddetect: { key: 'floodDetect', type: 'toggle' },
        spamdetect: { key: 'spamDetect', type: 'toggle' },
        inappdetect: { key: 'inappDetect', type: 'toggle' },
        spamsmiliesdetect: { key: 'spamSmiliesDetect', type: 'toggle' },
        linkdetect: { key: 'linkDetect', type: 'toggle' },
        openaidetect: { key: 'openAiDetect', type: 'toggle' },
        status: { key: 'modFilters', type: 'toggle' }
    },

    /**
     * Executes the command.
     * @param {Bot} bot - Bot instance
     * @param {string} xatID - User ID
     * @param {string} message - Message
     * @param {string} from - Source (main, pc, pm)
     */
    async execute(bot, xatID, message, from) {
        if (!bot.hasPermission(xatID, from)) return;

        const opts = bot.state.settings;
        if (!message) {
            const bool = v => v ? 'on' : 'off';
            const status = Object.entries(this.options).map(([cmd, config]) => {
                const value = opts[config.key];
                const displayValue = config.type === 'toggle' ? bool(value) : value;
                return `${config.key}:${displayValue}`;
            }).join(' | ');
            return await bot.reply(status, xatID, from);
        }

        const [option, ...rest] = message.trim().split(/\s+/);
        const value = rest.join(' ');
        const optionLower = option.toLowerCase();
        let updateObj = {};

        // Link whitelist
        if (optionLower === 'linkwhitelist') {
            if (!rest.length) {
                const wl = opts.linkWhitelist && opts.linkWhitelist.length > 0 ? opts.linkWhitelist : 'nenhuma';
                return await bot.reply('Whitelist: ' + wl, xatID, from);
            }
            const [action, ...linkParts] = rest;
            const link = linkParts.join(' ');

            if (!action || !['add', 'remove'].includes(action.toLowerCase()) || !link)
                return await bot.reply('Use: !mod linkwhitelist add|remove [link]', xatID, from);

            const currentList = opts.linkWhitelist ? opts.linkWhitelist.split(',') : [];
            
            if (action.toLowerCase() === 'add') {
                if (!currentList.includes(link)) currentList.push(link);
            } else {
                const index = currentList.indexOf(link);
                if (index > -1) currentList.splice(index, 1);
            }

            updateObj.linkWhitelist = currentList.join(',');
        } 

        // Other filters
        else if (this.options[optionLower]) {
            const config = this.options[optionLower];
            
            if (config.type === 'number') {
                if (!/^[0-9]+$/.test(value))
                    return await bot.reply('Must be a number.', xatID, from);
                updateObj[config.key] = parseInt(value);
            } else if (config.type === 'toggle') {
                if (!['on', 'off'].includes(value.toLowerCase()))
                    return await bot.reply('Must be "on" or "off".', xatID, from);
                updateObj[config.key] = value.toLowerCase() === 'on';
            }
        } 

        // Invalid option
        else {
            return await bot.reply(
                'Available options: ' + Object.keys(this.options).concat('linkwhitelist').join(', '),
                xatID,
                from
            );
        }

        await bot.updateDb(updateObj);
        await bot.reply('Settings updated.', xatID, from);
        await bot.restart();
    }
};