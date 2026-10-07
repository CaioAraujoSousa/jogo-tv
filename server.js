const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameState = require('./src/gameState');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    pingTimeout: 5000,
    pingInterval: 10000
});

app.use(express.static('public'));

app.get('/reset', (req, res) => {
    clearRoundTimer();
    isTransitioning = false;
    gameState.reset();
    io.emit('update-lobby', []);
    res.send('<h1>Sala resetada com sucesso! Volte ao jogo.</h1>');
});

// --- CONTROLE DE TEMPORIZADOR E TRAVAS DE ESTADO ---
let roundTimerInterval = null;
let roundTimeoutHandle = null;
let roundTimeLeft = 0;
let isTransitioning = false; // Trava para impedir avanços duplos de rodada

function clearRoundTimer() {
    if (roundTimerInterval) {
        clearInterval(roundTimerInterval);
        roundTimerInterval = null;
    }
    if (roundTimeoutHandle) {
        clearTimeout(roundTimeoutHandle);
        roundTimeoutHandle = null;
    }
}

function startRoundTimer(seconds, onTimeout) {
    clearRoundTimer();
    isTransitioning = false; // Libera nova rodada para processar envios
    roundTimeLeft = seconds;
    io.emit('timer-tick', roundTimeLeft);

    roundTimerInterval = setInterval(() => {
        roundTimeLeft--;
        io.emit('timer-tick', roundTimeLeft);

        if (roundTimeLeft <= 0) {
            clearRoundTimer();
            
            // Tolerância de 1.2s rastreada para poder ser cancelada se necessário
            roundTimeoutHandle = setTimeout(() => {
                onTimeout();
            }, 1200);
        }
    }, 1000);
}

io.on('connection', (socket) => {
    console.log('Novo dispositivo conectado:', socket.id);

    socket.emit('update-lobby', gameState.players);

    socket.on('join-game', (data) => {
        if (gameState.isStarted) {
            socket.emit('error-message', 'O jogo já começou! Aguarde a próxima partida.');
            return;
        }
        if (gameState.players.length >= 8) {
            socket.emit('error-message', 'A sala está cheia! (Máximo de 8 jogadores)');
            return;
        }
        if (gameState.players.some(p => p.name === data.name)) {
            socket.emit('error-message', 'Este nome já está em uso. Escolha outro!');
            return;
        }

        gameState.addPlayer(socket.id, data.name, data.avatar);
        io.emit('update-lobby', gameState.players);
    });

    socket.on('start-game', () => {
        if (gameState.players.length < 2) {
            socket.emit('error-message', 'É necessário pelo menos 2 jogadores para iniciar a partida!');
            return;
        }
        if (gameState.players[0].id !== socket.id) return;

        const roundData = gameState.startGame();
        if (roundData) {
            io.emit('start-round', roundData);
            startRoundTimer(60, () => handleDrawingCompletion());
        }
    });

    socket.on('submit-drawing', (imageData) => {
        const isPlayer = gameState.players.some(p => p.id === socket.id);
        if (!isPlayer || isTransitioning) return;

        const submittedCount = gameState.submitDrawing(socket.id, imageData);
        io.emit('drawing-progress', { submitted: submittedCount, total: gameState.players.length });

        if (gameState.allDrawingsSubmitted()) {
            handleDrawingCompletion();
        }
    });

    socket.on('submit-votes', (data) => {
        const isPlayer = gameState.players.some(p => p.id === socket.id);
        if (!isPlayer || isTransitioning) return;

        const roundNum = data.round;
        const votesArray = data.votes;
        
        gameState.submitVote(socket.id, roundNum, votesArray);

        if (gameState.allVotesSubmitted(roundNum)) {
            handleVotingCompletion(roundNum);
        }
    });

    socket.on('return-to-lobby', () => {
        if (gameState.players.length === 0) return;
        if (gameState.players[0].id !== socket.id) return;

        clearRoundTimer();
        isTransitioning = false;
        gameState.returnToLobby();
        io.emit('back-to-lobby', gameState.players);
        io.emit('update-lobby', gameState.players);
    });

    socket.on('disconnect', () => {
        console.log(`Dispositivo desconectado: ${socket.id}`);

        if (gameState.isStarted) {
            if (typeof gameState.setDisconnected === 'function') {
                gameState.setDisconnected(socket.id);
            }

            // Se a saída dele completar as submissões restantes de quem está online
            if (!isTransitioning) {
                if (gameState.allDrawingsSubmitted()) {
                    handleDrawingCompletion();
                } else if (gameState.currentRound && gameState.allVotesSubmitted(gameState.currentRound)) {
                    handleVotingCompletion(gameState.currentRound);
                }
            }
            return;
        }

        gameState.removePlayer(socket.id);
        io.emit('update-lobby', gameState.players);
    });
});

function handleDrawingCompletion() {
    if (isTransitioning) return;
    isTransitioning = true;
    clearRoundTimer();

    const currentRound = gameState.currentRound;

    if (currentRound < 3) {
        gameState.currentRound++;
        const roundData = gameState.getCurrentRoundData();
        io.emit('start-round', roundData);
        startRoundTimer(60, () => handleDrawingCompletion());
    } else if (currentRound === 3) {
        const votingCards = gameState.getVotingCards(1);
        io.emit('start-voting-round', votingCards);
        startRoundTimer(30, () => handleVotingCompletion(1));
    } else if (currentRound > 3 && currentRound < 6) {
        gameState.currentRound++;
        const roundData = gameState.getCurrentRoundData();
        io.emit('start-round', roundData);
        startRoundTimer(60, () => handleDrawingCompletion());
    } else if (currentRound === 6) {
        const votingCards = gameState.getVotingCards(4);
        io.emit('start-voting-round', votingCards);
        startRoundTimer(30, () => handleVotingCompletion(4));
    }
}

function handleVotingCompletion(roundNum) {
    if (isTransitioning) return;
    isTransitioning = true;
    clearRoundTimer();

    if (roundNum < 3) {
        const votingCards = gameState.getVotingCards(roundNum + 1);
        io.emit('start-voting-round', votingCards);
        startRoundTimer(30, () => handleVotingCompletion(roundNum + 1));
    } else if (roundNum === 3) {
        gameState.currentRound = 4;
        const roundData = gameState.getCurrentRoundData();
        io.emit('start-round', roundData);
        startRoundTimer(60, () => handleDrawingCompletion());
    } else if (roundNum >= 4 && roundNum < 6) {
        const votingCards = gameState.getVotingCards(roundNum + 1);
        io.emit('start-voting-round', votingCards);
        startRoundTimer(30, () => handleVotingCompletion(roundNum + 1));
    } else if (roundNum === 6) {
        const leaderboard = gameState.calculateFinalLeaderboard();
        io.emit('game-over', leaderboard);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});