const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getRandomThemes } = require('./themes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Paleta de cores fixas para associar a cada número de desenho na TV/Celular
const COLOR_PALETTE = [
    '#a855f7', // 1 - Roxo
    '#22c55e', // 2 - Verde
    '#f97316', // 3 - Laranja
    '#3b82f6', // 4 - Azul
    '#ec4899', // 5 - Rosa
    '#eab308', // 6 - Amarelo
    '#06b6d4', // 7 - Ciano
    '#ef4444'  // 8 - Vermelho
];

let players = []; 
let gameState = {
    isStarted: false,
    currentRound: 0, 
    matchThemes: [],
    drawings: {},
    votes: {} // Guarda os votos por rodada
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

    socket.on('start-game', () => {
        if (players.length === 0) return;
        if (players[0].id !== socket.id) return;

        gameState.isStarted = true;
        gameState.currentRound = 1;
        gameState.matchThemes = getRandomThemes(6);
        gameState.drawings = {};
        gameState.votes = {};

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
        // Inicia a votação da Rodada 1 do Bloco 1
        startVotingForRound(1);
    } else if (currentRound > 3 && currentRound < 6) {
        startRound(currentRound + 1);
    } else if (currentRound === 6) {
        // Inicia a votação da Rodada 4 do Bloco 2
        startVotingForRound(4);
    }
}

function startVotingForRound(roundNum) {
    const theme = gameState.matchThemes[roundNum - 1];
    const roundDrawings = gameState.drawings[roundNum] || {};

    // Mapeia os desenhos atribuindo Número (1..N) e Cor única
    const drawingCards = Object.keys(roundDrawings).map((playerId, index) => {
        return {
            number: index + 1,
            color: COLOR_PALETTE[index % COLOR_PALETTE.length],
            artistId: playerId,
            imageData: roundDrawings[playerId]
        };
    });

    // Envia evento de votação para TV e Celulares
    io.emit('start-voting-round', {
        round: roundNum,
        theme: theme,
        cards: drawingCards
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});