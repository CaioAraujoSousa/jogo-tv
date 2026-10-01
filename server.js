const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getRandomThemes } = require('./themes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = []; 
let gameState = {
    isStarted: false,
    currentRound: 0, 
    matchThemes: [],
    drawings: {} 
};

io.on('connection', (socket) => {
    console.log('Novo dispositivo conectado:', socket.id);

    socket.emit('update-lobby', players);

    if (gameState.isStarted) {
        socket.emit('game-in-progress');
    }

    socket.on('join-game', (data) => {
        if (gameState.isStarted) {
            socket.emit('error-message', 'O jogo já começou! Aguarde a próxima partida.');
            return;
        }
        if (players.length >= 8) {
            socket.emit('error-message', 'A sala está cheia! (Máximo de 8 jogadores)');
            return;
        }
        if (players.some(p => p.name === data.name)) {
            socket.emit('error-message', 'Este nome já está em uso. Escolha outro!');
            return;
        }

        const newPlayer = {
            id: socket.id,
            name: data.name,
            avatar: data.avatar || '🦊',
            score: 0
        };

        players.push(newPlayer);
        io.emit('update-lobby', players);
    });

    // Iniciar o jogo (Agora acionado pelo telemóvel do Anfitrião)
    socket.on('start-game', () => {
        if (players.length === 0) return;
        
        // Segurança: Só o jogador índice 0 (Anfitrião) pode iniciar a partida!
        if (players[0].id !== socket.id) return;

        gameState.isStarted = true;
        gameState.currentRound = 1;
        gameState.matchThemes = getRandomThemes(6);
        gameState.drawings = {};

        startRound(1);
    });

    socket.on('submit-drawing', (imageData) => {
        const round = gameState.currentRound;
        if (!gameState.drawings[round]) {
            gameState.drawings[round] = {};
        }

        gameState.drawings[round][socket.id] = imageData;
        
        const submittedCount = Object.keys(gameState.drawings[round]).length;
        io.emit('drawing-progress', { submitted: submittedCount, total: players.length });

        if (submittedCount >= players.length) {
            proceedToNextStep();
        }
    });

    socket.on('disconnect', () => {
        const index = players.findIndex(p => p.id === socket.id);
        if (index !== -1) {
            players.splice(index, 1);
            // Ao enviar a lista atualizada, os telemóveis reavaliam quem é o novo Anfitrião (o novo índice 0)
            io.emit('update-lobby', players);
        }
    });
});

function startRound(roundNum) {
    gameState.currentRound = roundNum;
    const currentTheme = gameState.matchThemes[roundNum - 1];
    io.emit('start-round', { round: roundNum, theme: currentTheme });
}

function proceedToNextStep() {
    const currentRound = gameState.currentRound;

    if (currentRound < 3) {
        startRound(currentRound + 1);
    } else if (currentRound === 3) {
        console.log('Fim do Bloco 1. Enviando desenhos para a TV...');
        io.emit('show-presentation', { 
            block: 1, 
            rounds: [1, 2, 3], 
            themes: gameState.matchThemes.slice(0, 3), 
            drawings: gameState.drawings,
            players: players
        });
    } else if (currentRound > 3 && currentRound < 6) {
        startRound(currentRound + 1);
    } else if (currentRound === 6) {
        console.log('Fim do Bloco 2. Enviando desenhos para a TV...');
        io.emit('show-presentation', { 
            block: 2, 
            rounds: [4, 5, 6], 
            themes: gameState.matchThemes.slice(3, 6), 
            drawings: gameState.drawings,
            players: players
        });
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});