const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve os arquivos estáticos da pasta public
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Um dispositivo se conectou:', socket.id);

  // Quando o celular envia o evento "botao_apertado"
  socket.on('botao_apertado', (dados) => {
    console.log('Botão recebido do celular:', dados);
    // Transmite a mensagem para a TV (e todos os outros dispositivos)
    io.emit('atualizar_tv', dados);
  });

  socket.on('disconnect', () => {
    console.log('Dispositivo desconectado:', socket.id);
  });
});

// Usa a porta do Render ou a 3000 se estiver no seu PC
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});