// index.ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import './bot';
import { connectDB } from './db';
import userRoutes from './routes/user';
import { GameSessionManager } from './utils/gameSessionManager';

require('dotenv').config();

connectDB();

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
console.log(`Frontend URL: ${FRONTEND_URL}`);

const app = express();
const corsOptions = {
    origin: 'https://flipcoinui.vercel.app', // Your Vercel frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true, // If you're using cookies or authorization headers
};
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true, // If you're using cookies or authorization headers
    },
});

app.use(express.json());

// Use user routes
app.use('/user', userRoutes);

app.get('/', (req, res) => {
    res.send('Server is running');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Initialize GameSessionManager
const gameSessionManager = new GameSessionManager(io);

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
