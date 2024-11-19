"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// index.ts
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
require("./bot");
const db_1 = require("./db");
const user_1 = __importDefault(require("./routes/user"));
const gameSessionManager_1 = require("./utils/gameSessionManager");
require('dotenv').config();
(0, db_1.connectDB)();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://flipcoinui.vercel.app/";
console.log(`Frontend URL: ${FRONTEND_URL}`);
const app = (0, express_1.default)();
const corsOptions = {
    origin: 'https://flipcoinui.vercel.app', // Your Vercel frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true, // If you're using cookies or authorization headers
};
app.use((0, cors_1.default)(corsOptions));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true, // If you're using cookies or authorization headers
    },
});
app.use(express_1.default.json());
// Use user routes
app.use('/user', user_1.default);
app.get('/', (req, res) => {
    res.send('Server is running');
});
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
// Initialize GameSessionManager
const gameSessionManager = new gameSessionManager_1.GameSessionManager(io);
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // Handle player joining the game
    socket.on('joinGame', (data) => {
        gameSessionManager.handlePlayerJoin(socket, data);
    });
    // Handle player making a choice
    socket.on('makeChoice', (data) => {
        gameSessionManager.handlePlayerChoice(socket, data);
    });
    // Handle player disconnection
    socket.on('disconnect', () => {
        gameSessionManager.handlePlayerDisconnect(socket);
    });
});
