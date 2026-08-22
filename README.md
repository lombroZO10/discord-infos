# Free xat Bot
A powerful, open-source moderation bot for xat chat rooms. Built with Node.js, featuring AI-powered moderation, automated management, and comprehensive admin tools.

## Features
- **AI-Powered Moderation** - Smart content filtering with OpenAI
- **Automated Management** - Welcome messages, user tracking, activity monitoring
- **Comprehensive Commands** - Extensive command system for chat administration
- **Real-time Configuration** - Modify settings directly through chat
- **Auto-Recovery** - Automatic reconnection and error handling
- **Modern WebSocket** - Compatible with xat's latest implementation

## Quick Setup

### Requirements
- Node.js 18+
- xat account with API access
- (bot) assigned in your target chat

### Installation
```bash
git clone https://github.com/xlaming/free-xat-bot
cd free-xat-bot
npm install
```

### Configuration
Rename `.env.example` to `.env` and edit the fields:
```env
BOT_USER=your_xat_username
BOT_APIKEY=your_xat_api_key
BOT_CHAT=your_chat_name
CHAT_LANGUAGE=all
BOT_OWNERS=[42,281199,91667566]
DISABLED_POWERS=[29]
WEBSOCKET_URL=wss://bots.xat.com/v2
WEBSOCKET_ORIGIN=https://xat.com
OPENAI_KEY=""
```

### Launch
```bash
npm start
```

## Commands

### Basic Commands
| Command | Usage | Access | Description |
|---------|-------|--------|-------------|
| `!avatar` | `!avatar [url]` | Admin | Set bot avatar |
| `!char` | `!char [character]` | Admin | Change bot character |
| `!clear` | `!clear` | Admin | Clear chat (25 lines) |
| `!commands` | `!commands` | Everyone | List all available commands |
| `!home` | `!home [url]` / `!home clear` | Admin | Set or clear bot home link |
| `!id` | `!id [regname]` | Everyone | Get xat ID from username |
| `!info` | `!info` | Everyone | Show bot information |
| `!nick` | `!nick [name]` | Admin | Change bot nickname |
| `!pcback` | `!pcback on/off` | Admin | Toggle PCBack mode |
| `!ping` | `!ping` | Everyone | Test bot latency |
| `!pstyle` | `!pstyle [url]` | Admin | Set bot pstyle image |
| `!reg` | `!reg [xat_id]` | Everyone | Get username from xat ID |
| `!restart` | `!restart` | Admin | Restart the bot |
| `!say` | `!say [message]` | Admin | Make bot send a message |
| `!status` | `!status [message]` / `!status clear` | Admin | Set or clear bot status |
| `!stealth` | `!stealth on/off` | Admin | Toggle stealth mode |

### Auto Welcome System
| Command | Usage | Access | Description |
|---------|-------|--------|-------------|
| `!welcomemsg` | `!welcomemsg [message]` | Admin | Set welcome message (supports variables) |
| `!welcometype` | `!welcometype pc/pm` | Admin | Set welcome message type (PC or PM) |

### Moderation System

#### Toggle Filters
| Command | Description |
|---------|-------------|
| `!mod status on/off` | Enable/disable all moderation |
| `!mod capslockdetect on/off` | Toggle CAPS lock filter |
| `!mod flooddetect on/off` | Toggle flood filter |
| `!mod spamdetect on/off` | Toggle letter spam filter |
| `!mod spamsmiliesdetect on/off` | Toggle smiley spam filter |
| `!mod linkdetect on/off` | Toggle link filter |
| `!mod openaidetect on/off` | Toggle AI moderation filter |
| `!mod inappdetect on/off` | Toggle inappropriate message filter |

#### Set Limits
| Command | Description | Default |
|---------|-------------|---------|
| `!mod maxkicks [number]` | Max kicks before ban | 3 |
| `!mod bantime [hours]` | Ban duration in hours | 1 |
| `!mod capslockmax [number]` | Max CAPS letters allowed | 6 |
| `!mod linesmax [number]` | Max messages in a row | 4 |
| `!mod maxletters [number]` | Max repeated letters | 8 |
| `!mod maxsmilies [number]` | Max smilies per message | 4 |

#### Link Whitelist
| Command | Description |
|---------|-------------|
| `!mod linkwhitelist` | Show whitelisted domains |
| `!mod linkwhitelist add [domain]` | Add domain to whitelist |
| `!mod linkwhitelist remove [domain]` | Remove domain from whitelist |

## Configuration Guide

### Getting Credentials
- **Username**: Your registered xat username for the bot account
- **API Key**: Available from xat's login interface after authentication
- **Chat Name**: Target chat room name (e.g., "help", "lobby")

### Bot Owners
Add user IDs to `BOT_OWNERS` array for admin access. 

Find IDs using `!id username` command.

### Power Management
Configure `DISABLED_POWERS` to restrict certain xat powers. 

Power ID 29 (invisible) is disabled by default.

## Troubleshooting

**Connection Issues**
- Verify credentials and API key
- Check chat permissions and accessibility
- Review WebSocket configuration

**Command Problems**
- Ensure user ID is in `BOT_OWNERS` array
- Verify command syntax and bot permissions
- Check console logs for errors

**Database Errors**
- Delete `database.db` to reset
- Check file permissions

## Security

- Never share `.env` files or credentials
- Limit `BOT_OWNERS` to trusted users only
- Keep dependencies updated

## Development

### Custom Commands
Create new files in `src/commands/`:
```javascript
export default {
    name: "commandname",
    
    async execute(bot, xatID, message, from) {
        if (!bot.hasPermission(xatID, from)) {
            return bot.reply("Insufficient permissions", xatID, from);
        }
        
        await bot.reply("Command response", xatID, from);
    }
};
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Test thoroughly
4. Submit pull request

## License

MIT License - see [LICENSE](LICENSE) file.

## Support

- **Website**: [bot.xatblog.net](https://bot.xatblog.net)
- **Issues**: [GitHub Issues](https://github.com/xlaming/free-xat-bot/issues)
- **Developer**: @xlaming
