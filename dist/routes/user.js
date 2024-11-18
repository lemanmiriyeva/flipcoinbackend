"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = __importDefault(require("../models/User"));
const router = express_1.default.Router();
// Get Coin Balance
router.post('/getCoins', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { telegramId } = req.body;
    try {
        let user = yield User_1.default.findOne({ telegramId });
        if (!user) {
            // Create a new user if not found
            user = new User_1.default({ telegramId, coins: 100 });
            yield user.save();
        }
        res.json({ coins: user.coins });
    }
    catch (error) {
        console.error('Error fetching coin balance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// Update Coin Balance
router.post('/updateCoins', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { telegramId, coins } = req.body;
    try {
        const user = yield User_1.default.findOneAndUpdate({ telegramId }, { coins }, { new: true, upsert: true });
        res.json({ coins: user.coins });
    }
    catch (error) {
        console.error('Error updating coin balance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// Get Leaderboard
router.get('/leaderboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const topUsers = yield User_1.default.find().sort({ coins: -1 }).limit(10);
        const leaderboard = topUsers.map(user => ({
            telegramId: user.telegramId,
            firstName: user.firstName || 'Unknown',
            coins: user.coins,
        }));
        res.json({ leaderboard });
    }
    catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
exports.default = router;
