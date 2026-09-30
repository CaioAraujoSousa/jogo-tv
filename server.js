const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = []; // Lista de jogadores conectados (máximo 8)

io.on('connection', (socket) => {
    console.log('Novo dispositivo conectado:', socket.id);

    // Envia o estado atual do lobby para quem acabou de conectar
    socket.emit('update-lobby', players);

    // Quando um jogador tenta entrar na sala pelo telemóvel
    socket.on('join-game', (data) => {
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
            avatar: data.avatar || '🦊'
        };

        players.push(newPlayer);
        console.log(`Jogador entrou: \({newPlayer.name} (\){newPlayer.avatar})`);

        // Atualiza a TV e todos os telemóveis com o novo lobby
        io.emit('update-lobby', players);
    });

    // Quando alguém fecha a página ou desconecta
    socket.on('disconnect', () => {
        console.log('Usuário desconectado:', socket.id);
        const index = players.findIndex(p => p.id === socket.id);
        if (index !== -1) {
            const removed = players.splice(index, 1)[0];
            console.log(`Jogador saiu: ${removed.name}`);
            io.emit('update-lobby', players);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});