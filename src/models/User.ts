import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true },
    firstName: { type: String },
    coins: { type: Number, default: 0 },
    wins: { type: Number, default: 0 }, // Track total wins
    consecutiveWins: { type: Number, default: 0 }, // Track consecutive wins
    consecutiveHeads: { type: Number, default: 0 }, // Track consecutive heads flips
    achievements: { type: [String], default: [] } // Store unlocked achievements
});

const User = mongoose.model('User', userSchema);

export default User;
