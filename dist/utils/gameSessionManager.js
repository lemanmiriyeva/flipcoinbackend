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
exports.GameSessionManager = void 0;
const uuid_1 = require("uuid");
const User_1 = __importDefault(require("../models/User"));
class GameSessionManager {
    constructor(io) {
        this.waitingPlayers = new Map(); // To store waiting players by their ID
        this.gameSessions = new Map(); // To store active game sessions
        this.MAX_WINS = 3;
        this.MAX_ROUNDS = 5;
        this.io = io;
        // Add a logging mechanism to debug stuck game sessions and players
        setInterval(() => {
            console.log('Active Game Sessions:', [...this.gameSessions.keys()]);
            console.log('Waiting Players:', [...this.waitingPlayers.keys()]);
        }, 30000); // Logs every 30 seconds
    }
    handlePlayerJoin(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { telegramId, firstName, avatar } = data;
            try {
                let user = yield User_1.default.findOne({ telegramId });
                if (!user) {
                    user = new User_1.default({ telegramId, firstName, coins: 100, achievements: [] });
                    yield user.save();
                }
                else if (user.firstName !== firstName) {
                    user.firstName = firstName;
                    yield user.save();
                }
                const currentPlayer = {
                    socket,
                    telegramId,
                    username: user.firstName || 'Unknown',
                    avatar: avatar || '',
                    roundWins: 0,
                };
                // Check if the player is already waiting or playing a game
                if (this.waitingPlayers.has(telegramId) || this.findGameSessionByPlayer(socket.id)) {
                    socket.emit('error', { message: 'You are already in a game or waiting for a player.' });
                    return;
                }
                // Timeout to auto-remove the player if they are stuck in the waiting queue
                const timeout = setTimeout(() => {
                    if (this.waitingPlayers.has(telegramId)) {
                        this.waitingPlayers.delete(telegramId);
                        socket.emit('error', { message: 'You were removed from the queue due to inactivity.' });
                    }
                }, 120000); // 2 minutes
                currentPlayer.socket.on('disconnect', () => clearTimeout(timeout));
                // Try to match with another waiting player
                if (this.waitingPlayers.size > 0) {
                    // Get the first player in the queue
                    const nextEntry = this.waitingPlayers.entries().next();
                    if (!nextEntry.done) {
                        const [waitingTelegramId, waitingPlayer] = nextEntry.value;
                        // Prevent same player from playing with themselves
                        if (waitingPlayer.telegramId === telegramId) {
                            socket.emit('error', { message: 'You cannot play against yourself.' });
                            return;
                        }
                        // Start a new game
                        this.startGame(waitingPlayer, currentPlayer);
                        this.waitingPlayers.delete(waitingTelegramId);
                    }
                }
                else {
                    // Add player to waiting queue
                    this.waitingPlayers.set(telegramId, currentPlayer);
                    socket.emit('waitingForPlayer');
                }
            }
            catch (error) {
                console.error('Error fetching user data:', error);
                socket.emit('error', { message: 'Server error occurred.' });
            }
        });
    }
    startGame(playerOne, playerTwo) {
        const gameId = (0, uuid_1.v4)(); // Generate a unique game ID
        const newGameSession = {
            gameId,
            players: [playerOne, playerTwo],
            isGameOver: false,
            roundsPlayed: 0,
        };
        this.gameSessions.set(gameId, newGameSession);
        // Remove both players from the waiting queue if they are there
        this.waitingPlayers.delete(playerOne.telegramId);
        this.waitingPlayers.delete(playerTwo.telegramId);
        // Add both players to the same room
        playerOne.socket.join(gameId);
        playerTwo.socket.join(gameId);
        // Emit 'gameStarted' to both players
        this.io.to(gameId).emit('gameStarted', {
            gameId,
            opponentId: playerTwo.telegramId,
            opponentAvatar: playerTwo.avatar,
        });
        this.startNewRound(gameId);
    }
    startNewRound(gameId) {
        const gameSession = this.gameSessions.get(gameId);
        if (!gameSession)
            return;
        gameSession.roundsPlayed++; // Increment roundsPlayed
        gameSession.players.forEach((player) => {
            player.choice = undefined; // Reset player's choice
            // Notify each player to make their choice
            player.socket.emit('newRound', { roundNumber: gameSession.roundsPlayed });
        });
    }
    handlePlayerChoice(socket, data) {
        const gameSession = this.findGameSessionByPlayer(socket.id);
        if (!gameSession || gameSession.isGameOver)
            return;
        const player = gameSession.players.find((p) => p.socket.id === socket.id);
        if (player) {
            player.choice = data.choice;
            this.checkForRoundCompletion(gameSession);
        }
    }
    checkForRoundCompletion(gameSession) {
        return __awaiter(this, void 0, void 0, function* () {
            if (gameSession.players.every((p) => p.choice)) {
                const playerOneChoice = gameSession.players[0].choice;
                const playerTwoChoice = gameSession.players[1].choice;
                // If both players choose the same side, randomly assign a winner and loser
                if (playerOneChoice === playerTwoChoice) {
                    const randomWinnerIndex = Math.random() < 0.5 ? 0 : 1;
                    const randomLoserIndex = randomWinnerIndex === 0 ? 1 : 0;
                    // Increment the round wins for the randomly selected winner
                    gameSession.players[randomWinnerIndex].roundWins += 1;
                    // Emit result to the winner
                    gameSession.players[randomWinnerIndex].socket.emit('roundResult', {
                        coinResult: null, // No coin flip result needed
                        isWinner: true,
                        playerWins: gameSession.players[randomWinnerIndex].roundWins,
                        opponentWins: gameSession.players[randomLoserIndex].roundWins,
                        message: 'You won this round!',
                    });
                    // Emit result to the loser
                    gameSession.players[randomLoserIndex].socket.emit('roundResult', {
                        coinResult: null, // No coin flip result needed
                        isWinner: false,
                        playerWins: gameSession.players[randomLoserIndex].roundWins,
                        opponentWins: gameSession.players[randomWinnerIndex].roundWins,
                        message: 'You lost this round!',
                    });
                }
                else {
                    // Simulate coin flip if both players chose different sides
                    const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
                    // Determine winners and update scores
                    gameSession.players.forEach((player) => {
                        var _a;
                        const isWinner = player.choice === coinResult;
                        if (isWinner) {
                            player.roundWins += 1;
                        }
                        player.socket.emit('roundResult', {
                            coinResult,
                            isWinner,
                            playerWins: player.roundWins,
                            opponentWins: ((_a = gameSession.players.find((p) => p.socket.id !== player.socket.id)) === null || _a === void 0 ? void 0 : _a.roundWins) || 0,
                        });
                    });
                }
                // Check if the game should end due to max rounds or max wins
                if (gameSession.roundsPlayed >= this.MAX_ROUNDS ||
                    gameSession.players.some((p) => p.roundWins === this.MAX_WINS)) {
                    gameSession.isGameOver = true;
                    const winner = this.determineWinner(gameSession);
                    yield this.endGameSession(gameSession, winner);
                }
                else {
                    // Start a new round
                    this.startNewRound(gameSession.gameId);
                }
            }
        });
    }
    determineWinner(gameSession) {
        const [playerOne, playerTwo] = gameSession.players;
        if (playerOne.roundWins > playerTwo.roundWins) {
            return playerOne;
        }
        else if (playerTwo.roundWins > playerOne.roundWins) {
            return playerTwo;
        }
        else {
            return null; // It's a tie
        }
    }
    endGameSession(gameSession, winner) {
        return __awaiter(this, void 0, void 0, function* () {
            if (winner) {
                yield User_1.default.findOneAndUpdate({ telegramId: winner.telegramId }, { $inc: { coins: 10 } } // Winner gets 10 coins
                );
                const loser = gameSession.players.find((p) => p.telegramId !== winner.telegramId);
                if (loser) {
                    const user = yield User_1.default.findOne({ telegramId: loser.telegramId });
                    if (user && user.coins > 0) {
                        const coinsToSubtract = Math.min(10, user.coins);
                        yield User_1.default.findOneAndUpdate({ telegramId: loser.telegramId }, { $inc: { coins: -coinsToSubtract } });
                    }
                }
            }
            this.io.to(gameSession.gameId).emit('gameOver', { winnerId: winner ? winner.telegramId : null });
            this.cleanUpGameSession(gameSession.gameId);
        });
    }
    cleanUpGameSession(gameId) {
        this.gameSessions.delete(gameId);
        this.io.in(gameId).socketsLeave(gameId); // Remove all sockets from the room
    }
    handlePlayerDisconnect(socket) {
        const gameSession = this.findGameSessionByPlayer(socket.id);
        if (gameSession) {
            const remainingPlayer = gameSession.players.find((p) => p.socket.id !== socket.id);
            if (remainingPlayer && !gameSession.isGameOver) {
                gameSession.isGameOver = true;
                remainingPlayer.roundWins = this.MAX_WINS; // Declare remaining player as the winner
                remainingPlayer.socket.emit('gameOver', { winnerId: remainingPlayer.telegramId });
                this.cleanUpGameSession(gameSession.gameId);
            }
        }
        // Remove player from the waiting queue if they're in it
        const player = [...this.waitingPlayers.values()].find((p) => p.socket.id === socket.id);
        if (player) {
            this.waitingPlayers.delete(player.telegramId);
        }
    }
    findGameSessionByPlayer(socketId) {
        return [...this.gameSessions.values()].find((session) => session.players.some((p) => p.socket.id === socketId));
    }
    checkAchievements(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const achievementsList = [
                { name: 'First Win', condition: (user) => user.totalWins === 1 },
                { name: '10 Wins Streak', condition: (user) => user.consecutiveWins >= 10 },
                { name: 'Lucky Flip', condition: (user) => user.consecutiveHeads >= 5 },
                { name: 'Coin Collector', condition: (user) => user.coins >= 100 },
            ];
            let unlockedAchievements = [];
            for (const achievement of achievementsList) {
                if (achievement.condition(user) && !user.achievements.includes(achievement.name)) {
                    user.achievements.push(achievement.name);
                    unlockedAchievements.push(achievement.name);
                }
            }
            if (unlockedAchievements.length > 0) {
                yield user.save();
            }
            return unlockedAchievements;
        });
    }
}
exports.GameSessionManager = GameSessionManager;
