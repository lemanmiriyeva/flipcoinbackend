"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    telegramId: { type: String, required: true },
    firstName: { type: String },
    coins: { type: Number, default: 0 },
    wins: { type: Number, default: 0 }, // Track total wins
    consecutiveWins: { type: Number, default: 0 }, // Track consecutive wins
    consecutiveHeads: { type: Number, default: 0 }, // Track consecutive heads flips
    achievements: { type: [String], default: [] } // Store unlocked achievements
});
const User = mongoose_1.default.model('User', userSchema);
exports.default = User;
