const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameState = require('./src/gameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/reset', (req, res) => {
    gameState.reset();
    io.emit('update-lobby', []);
    res.send('<h1>Sala resetada com sucesso! Volte ao jogo.</h1>');
});

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
        if (gameState.players.length === 0) return;
        if (gameState.players[0].id !== socket.id) return;

        const roundData = gameState.startGame();
        io.emit('start-round', roundData);
    });

    socket.on('submit-drawing', (imageData) => {
        const submittedCount = gameState.submitDrawing(socket.id, imageData);
        io.emit('drawing-progress', { submitted: submittedCount, total: gameState.players.length });

        if (gameState.allDrawingsSubmitted()) {
            handleDrawingCompletion();
        }
    });

    socket.on('submit-votes', (data) => {
        const roundNum = data.round;
        const votesArray = data.votes;
        
        gameState.submitVote(socket.id, roundNum, votesArray);

        if (gameState.allVotesSubmitted(roundNum)) {
            handleVotingCompletion(roundNum);
        }
    });

    socket.on('disconnect', () => {
        gameState.removePlayer(socket.id);
        io.emit('update-lobby', gameState.players);
    });
});

function handleDrawingCompletion() {
    const currentRound = gameState.currentRound;

    if (currentRound < 3) {
        gameState.currentRound++;
        io.emit('start-round', gameState.getCurrentRoundData());
    } else if (currentRound === 3) {
        io.emit('start-voting-round', gameState.getVotingCards(1));
    } else if (currentRound > 3 && currentRound < 6) {
        gameState.currentRound++;
        io.emit('start-round', gameState.getCurrentRoundData());
    } else if (currentRound === 6) {
        io.emit('start-voting-round', gameState.getVotingCards(4));
    }
}

function handleVotingCompletion(roundNum) {
    if (roundNum < 3) {
        io.emit('start-voting-round', gameState.getVotingCards(roundNum + 1));
    } else if (roundNum === 3) {
        gameState.currentRound = 4;
        io.emit('start-round', gameState.getCurrentRoundData());
    } else if (roundNum >= 4 && roundNum < 6) {
        io.emit('start-voting-round', gameState.getVotingCards(roundNum + 1));
    } else if (roundNum === 6) {
        const leaderboard = gameState.calculateFinalLeaderboard();
        io.emit('game-over', leaderboard);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});