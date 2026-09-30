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
    currentRound: 0, // 1 a 6
    matchThemes: [],
    drawings: {} // Guarda os desenhos por ronda e por jogador: { ronda: { playerId: imageData } }
};

io.on('connection', (socket) => {
    console.log('Novo dispositivo conectado:', socket.id);

    socket.emit('update-lobby', players);

    // Se o jogo já estiver a decorrer e alguém entrar ou recarregar, avisa
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

    // Iniciar o jogo (Anfitrião clica na TV)
    socket.on('start-game', () => {
        if (players.length === 0) return;

        gameState.isStarted = true;
        gameState.currentRound = 1;
        gameState.matchThemes = getRandomThemes(6); // Sorteia 6 temas para as 6 rondas
        gameState.drawings = {};

        console.log('Temas sorteados para a partida:', gameState.matchThemes);

        startRound(1);
    });

    // Quando um jogador envia o seu desenho
    socket.on('submit-drawing', (imageData) => {
        const round = gameState.currentRound;
        if (!gameState.drawings[round]) {
            gameState.drawings[round] = {};
        }

        gameState.drawings[round][socket.id] = imageData;
        console.log(`Desenho recebido do jogador \({socket.id} para a ronda\){round}`);

        // Conta quantos jogadores já enviaram o desenho nesta ronda
        const submittedCount = Object.keys(gameState.drawings[round]).length;
        
        // Informa a TV sobre quantas pessoas já entregaram o desenho
        io.emit('drawing-progress', { submitted: submittedCount, total: players.length });

        // Se todos os jogadores conectados já entregaram o desenho
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

    console.log(`Iniciando Ronda \({roundNum}:\){currentTheme}`);

    // Envia o tema da ronda atual para a TV e para os telemóveis
    io.emit('start-round', {
        round: roundNum,
        theme: currentTheme
    });
}

function proceedToNextStep() {
    const currentRound = gameState.currentRound;

    if (currentRound < 3) {
        // Bloco 1: Avança para a próxima ronda de desenho (2 ou 3)
        startRound(currentRound + 1);
    } else if (currentRound === 3) {
        // Fim do Bloco 1 (Ronda 3 terminada) -> Hora de ir para a primeira Votação!
        console.log('Fim do Bloco 1. Preparando tela de votação...');
        // Vamos programar a tela de votação logo a seguir
        io.emit('show-voting-phase', { block: 1, drawings: gameState.drawings });
    } else if (currentRound > 3 && currentRound < 6) {
        // Bloco 2: Avança para as rondas 4, 5 ou 6
        startRound(currentRound + 1);
    } else if (currentRound === 6) {
        // Fim do Bloco 2 -> Votação final e Pódio
        console.log('Fim do Bloco 2. Preparando votação final e pódio...');
        io.emit('show-voting-phase', { block: 2, drawings: gameState.drawings });
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});