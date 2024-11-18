import express from 'express';
import crypto from 'crypto';
import User from '../models/User';

const router = express.Router();

const validateWebAppData = (botToken: string, authData: any): boolean => {
    const checkString = Object.keys(authData)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${authData[key]}`)
        .join('\n');

    const secretKey = crypto.createHmac('sha256', botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    return hash === authData.hash;
};

router.post('/telegram', async (req, res) => {
    const { authData } = req.body;

    const isValid = validateWebAppData('YOUR_TELEGRAM_BOT_TOKEN', authData);

    if (isValid) {
        const userData = JSON.parse(
            '{' +
            decodeURIComponent(authData)
                .replace(/&/g, '","')
                .replace(/=/g, '":"') +
            ' }'
        );

        // Save or update the user in the database
        const user = await User.findOneAndUpdate(
            { telegramId: userData.id },
            {
                telegramId: userData.id,
                username: userData.username,
            },
            { upsert: true, new: true }
        );

        res.json({ status: 'success', user });
    } else {
        res.status(401).json({ status: 'error', message: 'Invalid data' });
    }
});

export default router;