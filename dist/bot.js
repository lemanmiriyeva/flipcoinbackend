"use strict";
// bot.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
// Replace 'YOUR_BOT_TOKEN' with your actual bot token from BotFather
const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
// Create a bot that uses 'polling' to fetch new updates
const bot = new node_telegram_bot_api_1.default(token, { polling: true });
// Your Web App URL
const webAppUrl = process.env.FRONTEND_URL || 'https://flipcoinui.vercel.app/';
// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to the Flip Coin Game! Use /play to start playing.');
});
// Handle /play command
bot.onText(/\/play/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Click the button below to start the game:', {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Play Flip Coin Game',
                        web_app: { url: webAppUrl },
                    },
                ],
            ],
        },
    });
});
// Handle /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'This is the Flip Coin Game bot. Use /play to start playing.');
});
// Export the bot instance if needed elsewhere
exports.default = bot;
