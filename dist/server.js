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
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
require("./bot");
const db_1 = require("./db");
const User_1 = __importDefault(require("./models/User"));
const user_1 = __importDefault(require("./routes/user"));
require('dotenv').config();
(0, db_1.connectDB)();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
console.log(`Frontend URL: ${FRONTEND_URL}`);
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "https://flipcoinui.vercel.app", // Frontend URL
        methods: ["GET", "POST"],
        credentials: true
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Use user routes
app.use('/user', user_1.default);
app.get('/', (req, res) => {
    res.send('Server is running');
});
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
let waitingPlayer = null;
let gameSessions = new Map();
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // Handle player joining the game
    socket.on('joinGame', (data) => __awaiter(void 0, void 0, void 0, function* () {
        const { telegramId, firstName, avatar } = data;
        console.log('telegramId:', telegramId);
        try {
            // Fetch or create user in the database
            let user = yield User_1.default.findOne({ telegramId });
            if (!user) {
                user = new User_1.default({ telegramId, firstName, coins: 100, achievements: [] });
                yield user.save();
            }
            else {
                // Update firstName if changed
                if (!user.firstName || user.firstName !== firstName) {
                    user.firstName = firstName;
                    yield user.save();
                }
            }
            const currentPlayer = {
                socketId: socket.id,
                telegramId,
                username: user.firstName || 'Unknown',
                avatar: avatar || '',
            };
            if (waitingPlayer) {
                // Start a game with the waiting player and current player
                const gameId = `${waitingPlayer.socketId}-${currentPlayer.socketId}`;
                const newGameSession = {
                    gameId,
                    players: [waitingPlayer, currentPlayer],
                    isGameOver: false,
                };
                // Store the game session
                gameSessions.set(gameId, newGameSession);
                // Notify both players that the game has started
                io.to(waitingPlayer.socketId).emit('gameStarted', {
                    gameId,
                    opponentId: currentPlayer.telegramId,
                    opponentAvatar: currentPlayer.avatar,
                });
                io.to(currentPlayer.socketId).emit('gameStarted', {
                    gameId,
                    opponentId: waitingPlayer.telegramId,
                    opponentAvatar: waitingPlayer.avatar,
                });
                console.log(`Game started between ${waitingPlayer.socketId} and ${currentPlayer.socketId}`);
                // Reset waitingPlayer
                waitingPlayer = null;
            }
            else {
                // No waiting players, set current player as waiting
                waitingPlayer = currentPlayer;
                socket.emit('waitingForPlayer');
                console.log(`Player ${socket.id} is waiting for an opponent`);
            }
        }
        catch (error) {
            console.error('Error fetching user data:', error);
            socket.emit('error', { message: 'Server error occurred.' });
        }
    }));
    // Handle player making a choice
    socket.on('makeChoice', (data) => {
        const { choice } = data;
        console.log(`Player ${socket.id} made a choice: ${choice}`);
        // Find the game session the player is in
        let gameSession;
        for (let session of gameSessions.values()) {
            if (session.players.some((player) => player.socketId === socket.id)) {
                gameSession = session;
                break;
            }
        }
        if (!gameSession) {
            console.log(`Game session not found for player ${socket.id}`);
            return;
        }
        // Update player's choice
        const player = gameSession.players.find((p) => p.socketId === socket.id);
        if (player) {
            player.choice = choice;
        }
        // Check if both players have made their choices
        if (gameSession.players.every((player) => player.choice)) {
            // Both players have made their choices
            // Simulate coin flip
            const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
            console.log(`Coin result for game ${gameSession.gameId}: ${coinResult}`);
            // Determine winners and losers
            gameSession.players.forEach((player) => __awaiter(void 0, void 0, void 0, function* () {
                const isWinner = player.choice === coinResult;
                const result = isWinner ? 'win' : 'lose';
                if (!gameSession.isGameOver) {
                    if (isWinner) {
                        // Update both coins and wins in the same update operation
                        yield User_1.default.findOneAndUpdate({ telegramId: player.telegramId }, { $inc: { coins: 10, wins: 1 } } // Increment both coins and wins together
                        );
                    }
                    else {
                        // Check the user's current coins before subtracting
                        const user = yield User_1.default.findOne({ telegramId: player.telegramId });
                        if (user) {
                            const coinsToSubtract = Math.min(10, user.coins); // Ensure it doesn't subtract more than the player has
                            // Loser loses coins, but doesn't go below 0
                            yield User_1.default.findOneAndUpdate({ telegramId: player.telegramId }, { $inc: { coins: -coinsToSubtract } } // Decrement by a maximum of the player's current coins
                            );
                        }
                        else {
                            console.error('User not found.');
                        }
                    }
                }
                const achievementsList = [
                    { name: "First Win", condition: (player) => player.wins === 1 },
                    { name: "10 Wins Streak", condition: (player) => player.consecutiveWins >= 10 },
                    { name: "Lucky Flip", condition: (player) => player.consecutiveHeads >= 5 },
                    { name: "Coin Collector", condition: (player) => player.coins >= 100 }
                ];
                const checkAchievements = (player) => __awaiter(void 0, void 0, void 0, function* () {
                    let unlockedAchievements = [];
                    achievementsList.forEach(achievement => {
                        // If the player meets the condition and hasn't unlocked it yet
                        if (achievement.condition(player) && !player.achievements.includes(achievement.name)) {
                            player.achievements.push(achievement.name);
                            unlockedAchievements.push(achievement.name);
                        }
                    });
                    if (unlockedAchievements.length > 0) {
                        yield player.save(); // Update the player data
                    }
                    return unlockedAchievements; // Return list of newly unlocked achievements
                });
                // Check achievements after the game result is updated
                const unlockedAchievements = yield checkAchievements(player);
                // Send unlocked achievements to the client
                if (unlockedAchievements.length > 0) {
                    io.to(player.socketId).emit('achievementsUnlocked', { achievements: unlockedAchievements });
                }
                // Send game result to each player
                io.to(player.socketId).emit('gameResult', {
                    coinResult,
                    winnerTelegramId: isWinner ? player.telegramId : null,
                });
            }));
            // Mark game as over
            gameSession.isGameOver = true;
            // Remove the game session after a delay
            setTimeout(() => {
                gameSessions.delete(gameSession.gameId);
                console.log(`Game ${gameSession.gameId} has ended and session is removed.`);
            }, 5000);
        }
    });
    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        // If the disconnected player was waiting, remove them from the queue
        if (waitingPlayer && waitingPlayer.socketId === socket.id) {
            waitingPlayer = null;
        }
        // Check if the disconnected player is in any active game session
        let gameIdToDelete = '';
        for (let [gameId, gameSession] of gameSessions.entries()) {
            if (gameSession.players.some((player) => player.socketId === socket.id)) {
                // Notify the other player that the game has ended
                const otherPlayer = gameSession.players.find((player) => player.socketId !== socket.id);
                if (otherPlayer) {
                    io.to(otherPlayer.socketId).emit('opponentDisconnected');
                }
                // Remove the game session
                gameIdToDelete = gameId;
                console.log(`Game ${gameId} ended due to player disconnection`);
                break;
            }
        }
        if (gameIdToDelete) {
            gameSessions.delete(gameIdToDelete);
        }
    });
});
// CORS configuration
app.use((0, cors_1.default)({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
}));
