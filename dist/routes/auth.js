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
const crypto_1 = __importDefault(require("crypto"));
const User_1 = __importDefault(require("../models/User"));
const router = express_1.default.Router();
const validateWebAppData = (botToken, authData) => {
    const checkString = Object.keys(authData)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${authData[key]}`)
        .join('\n');
    const secretKey = crypto_1.default.createHmac('sha256', botToken).digest();
    const hash = crypto_1.default.createHmac('sha256', secretKey).update(checkString).digest('hex');
    return hash === authData.hash;
};
router.post('/telegram', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { authData } = req.body;
    const isValid = validateWebAppData('YOUR_TELEGRAM_BOT_TOKEN', authData);
    if (isValid) {
        const userData = JSON.parse('{' +
            decodeURIComponent(authData)
                .replace(/&/g, '","')
                .replace(/=/g, '":"') +
            ' }');
        // Save or update the user in the database
        const user = yield User_1.default.findOneAndUpdate({ telegramId: userData.id }, {
            telegramId: userData.id,
            username: userData.username,
        }, { upsert: true, new: true });
        res.json({ status: 'success', user });
    }
    else {
        res.status(401).json({ status: 'error', message: 'Invalid data' });
    }
}));
exports.default = router;
