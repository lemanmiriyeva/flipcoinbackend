import express from 'express';
import User from '../models/User';

const router = express.Router();

// Get Coin Balance
router.post('/getCoins', async (req, res) => {
    const { telegramId } = req.body;
    try {
        let user = await User.findOne({ telegramId });
        if (!user) {
            // Create a new user if not found
            user = new User({ telegramId, coins: 100 });
            await user.save();
        }
        res.json({ coins: user.coins });
    } catch (error) {
        console.error('Error fetching coin balance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update Coin Balance
router.post('/updateCoins', async (req, res) => {
    const { telegramId, coins } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { telegramId },
            { coins },
            { new: true, upsert: true }
        );
        res.json({ coins: user.coins });
    } catch (error) {
        console.error('Error updating coin balance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const topUsers = await User.find().sort({ coins: -1 }).limit(10);
        const leaderboard = topUsers.map(user => ({
            telegramId: user.telegramId,
            firstName: user.firstName || 'Unknown',
            coins: user.coins,
        }));
        res.json({ leaderboard });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
