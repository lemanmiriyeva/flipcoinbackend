import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';
import './bot';
import {connectDB} from './db';
import User from './models/User';
import userRoutes from './routes/user';

require('dotenv').config();

connectDB();

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
console.log(`Frontend URL: ${FRONTEND_URL}`);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

app.use(cors());
app.use(express.json());

// Use user routes
app.use('/user', userRoutes);

app.get('/', (req, res) => {
    res.send('Server is running');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Define Player and GameSession interfaces
interface Player {
    socketId: string;
    telegramId: string;
    username: string;
    avatar: string; // Array of unlocked achievements
    choice?: 'heads' | 'tails',
    achievements?: string[];

}

interface GameSession {
    gameId: string;
    players: Player[];
    isGameOver: boolean;
}


let waitingPlayer: Player | null = null;
let gameSessions: Map<string, GameSession> = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle player joining the game
    socket.on('joinGame', async (data) => {
        const {telegramId, firstName, avatar} = data;

        console.log('telegramId:', telegramId);

        try {
            // Fetch or create user in the database
            let user = await User.findOne({telegramId});
            if (!user) {
                user = new User({telegramId, firstName, coins: 100, achievements: []});
                await user.save();
            } else {
                // Update firstName if changed
                if (!user.firstName || user.firstName !== firstName) {
                    user.firstName = firstName;
                    await user.save();
                }
            }

            const currentPlayer: Player = {
                socketId: socket.id,
                telegramId,
                username: user.firstName || 'Unknown',
                avatar: avatar || '',
            };

            if (waitingPlayer) {
                // Start a game with the waiting player and current player
                const gameId = `${waitingPlayer.socketId}-${currentPlayer.socketId}`;
                const newGameSession: GameSession = {
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
            } else {
                // No waiting players, set current player as waiting
                waitingPlayer = currentPlayer;
                socket.emit('waitingForPlayer');
                console.log(`Player ${socket.id} is waiting for an opponent`);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            socket.emit('error', {message: 'Server error occurred.'});
        }
    });

    // Handle player making a choice
    socket.on('makeChoice', (data) => {
        const {choice} = data;
        console.log(`Player ${socket.id} made a choice: ${choice}`);

        // Find the game session the player is in
        let gameSession: GameSession | undefined;
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
            const coinResult: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
            console.log(`Coin result for game ${gameSession.gameId}: ${coinResult}`);

            // Determine winners and losers
            gameSession.players.forEach(async (player) => {
                const isWinner = player.choice === coinResult;
                const result = isWinner ? 'win' : 'lose';

                if (!gameSession.isGameOver) {
                    if (isWinner) {
                        // Update both coins and wins in the same update operation
                        await User.findOneAndUpdate(
                            { telegramId: player.telegramId },
                            { $inc: { coins: 10, wins: 1 } }  // Increment both coins and wins together
                        );
                    } else {
                        // Check the user's current coins before subtracting
                        const user = await User.findOne({ telegramId: player.telegramId });

                        if (user) {
                            const coinsToSubtract = Math.min(10, user.coins);  // Ensure it doesn't subtract more than the player has

                            // Loser loses coins, but doesn't go below 0
                            await User.findOneAndUpdate(
                                { telegramId: player.telegramId },
                                { $inc: { coins: -coinsToSubtract } }  // Decrement by a maximum of the player's current coins
                            );
                        } else {
                            console.error('User not found.');
                        }
                    }
                }


                const achievementsList = [
                    {name: "First Win", condition: (player: any) => player.wins === 1},
                    {name: "10 Wins Streak", condition: (player: any) => player.consecutiveWins >= 10},
                    {name: "Lucky Flip", condition: (player: any) => player.consecutiveHeads >= 5},
                    {name: "Coin Collector", condition: (player: any) => player.coins >= 100}
                ];

                const checkAchievements = async (player: any) => {
                    let unlockedAchievements: any = [];

                    achievementsList.forEach(achievement => {
                        // If the player meets the condition and hasn't unlocked it yet
                        if (achievement.condition(player) && !player.achievements.includes(achievement.name)) {
                            player.achievements.push(achievement.name);
                            unlockedAchievements.push(achievement.name);
                        }
                    });

                    if (unlockedAchievements.length > 0) {
                        await player.save(); // Update the player data
                    }

                    return unlockedAchievements; // Return list of newly unlocked achievements
                };

                // Check achievements after the game result is updated
                const unlockedAchievements = await checkAchievements(player);

                // Send unlocked achievements to the client
                if (unlockedAchievements.length > 0) {
                    io.to(player.socketId).emit('achievementsUnlocked', {achievements: unlockedAchievements});
                }

                // Send game result to each player
                io.to(player.socketId).emit('gameResult', {
                    coinResult,
                    winnerTelegramId: isWinner ? player.telegramId : null,
                });
            });

            // Mark game as over
            gameSession.isGameOver = true;

            // Remove the game session after a delay
            setTimeout(() => {
                gameSessions.delete(gameSession!.gameId);
                console.log(`Game ${gameSession!.gameId} has ended and session is removed.`);
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
app.use(
    cors({
        origin: FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true,
    })
);
