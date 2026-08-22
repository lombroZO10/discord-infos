import { config } from 'dotenv';
import { sequelize } from './core/Database.js';
import { Bot } from './core/Bot.js';

config();

(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
    new Bot();
})();
