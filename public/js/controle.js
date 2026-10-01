import { initCanvas } from './modules/canvasEngine.js';
import { renderVotingScreen } from './modules/votingEngine.js';

const socket = io();
let selectedAvatar = '🦊';

document.querySelectorAll('.avatar-option').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatar = e.target.getAttribute('data-avatar');
    });
});

document.getElementById('join-btn').addEventListener('click', () => {
    const name = document.getElementById('nickname').value.trim();
    if (!name) {
        document.getElementById('error-msg').innerText = 'Por favor, digite um apelido!';
        return;
    }
    socket.emit('join-game', { name, avatar: selectedAvatar });
});

socket.on('error-message', (msg) => {
    document.getElementById('error-msg').innerText = msg;
});

socket.on('update-lobby', (players) => {
    const me = players.find(p => p.id === socket.id);
    if (me) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('waiting-screen').style.display = 'block';
        document.getElementById('user-display').innerText = me.avatar;
        document.getElementById('welcome-name').innerText = me.name;

        const isHost = players.length > 0 && players[0].id === socket.id;
        
        if (isHost) {
            document.getElementById('host-controls').style.display = 'block';
            document.getElementById('waiting-msg').style.display = 'none';
        } else {
            document.getElementById('host-controls').style.display = 'none';
            document.getElementById('waiting-msg').style.display = 'block';
            document.getElementById('waiting-msg').innerText = `Aguardando ${players[0].name} iniciar a partida...`;
        }
    }
});

document.getElementById('start-btn-mobile').addEventListener('click', () => {
    socket.emit('start-game');
});

// FASE DE DESENHO
socket.on('start-round', (data) => {
    document.getElementById('waiting-screen').style.display = 'none';
    const votingScreen = document.getElementById('voting-screen');
    if (votingScreen) votingScreen.style.display = 'none';
    
    const drawingScreen = document.getElementById('drawing-screen');
    drawingScreen.style.display = 'block';
    drawingScreen.innerHTML = '';

    // Caixas de texto do tema
    const themeBox = document.createElement('div');
    themeBox.className = 'theme-box';

    const roundSpan = document.createElement('span');
    roundSpan.style.fontSize = '0.85rem';
    roundSpan.style.color = '#94a3b8';
    roundSpan.textContent = `Rodada ${data.round} de 6 - TEMA:`;

    const themeTitle = document.createElement('h3');
    themeTitle.id = 'my-theme';
    themeTitle.style.margin = '5px 0';
    themeTitle.style.color = '#facc15';
    themeTitle.textContent = data.theme;

    themeBox.appendChild(roundSpan);
    themeBox.appendChild(themeTitle);

    // Canvas de desenho
    const canvas = document.createElement('canvas');
    canvas.id = 'paintCanvas';
    canvas.width = 320;
    canvas.height = 380;

    // Botões
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-btn';
    clearBtn.style.background = '#ef4444';
    clearBtn.textContent = 'Limpar';

    const submitBtn = document.createElement('button');
    submitBtn.id = 'submit-btn';
    submitBtn.style.background = '#22c55e';
    submitBtn.textContent = 'Enviar Desenho';

    toolbar.appendChild(clearBtn);
    toolbar.appendChild(submitBtn);

    drawingScreen.appendChild(themeBox);
    drawingScreen.appendChild(canvas);
    drawingScreen.appendChild(toolbar);

    // Inicializa a lógica de desenho do módulo
    initCanvas(canvas, clearBtn, submitBtn, socket);

    // Ecrã de confirmação ao clicar em Enviar
    submitBtn.addEventListener('click', () => {
        drawingScreen.innerHTML = '';
        
        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginTop = '50px';

        const h2 = document.createElement('h2');
        h2.textContent = 'Desenho Enviado! 🚀';

        const p = document.createElement('p');
        p.style.color = '#94a3b8';
        p.style.fontSize = '1rem';
        p.textContent = 'Aguardando os outros jogadores terminarem...';

        card.appendChild(h2);
        card.appendChild(p);
        drawingScreen.appendChild(card);
    });
});

// FASE DE VOTAÇÃO
socket.on('start-voting-round', (data) => {
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('drawing-screen').style.display = 'none';

    let votingScreen = document.getElementById('voting-screen');
    if (!votingScreen) {
        votingScreen = document.createElement('div');
        votingScreen.id = 'voting-screen';
        document.body.appendChild(votingScreen);
    }
    votingScreen.style.display = 'block';

    // Delega o render da votação para o módulo
    renderVotingScreen(votingScreen, data, socket);
});

// Adicionar no final do public/js/controle.js
socket.on('game-over', (leaderboard) => {
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('drawing-screen').style.display = 'none';

    let votingScreen = document.getElementById('voting-screen');
    if (!votingScreen) {
        votingScreen = document.createElement('div');
        votingScreen.id = 'voting-screen';
        document.body.appendChild(votingScreen);
    }
    votingScreen.style.display = 'block';
    votingScreen.innerHTML = '';

    const me = leaderboard.find(p => p.id === socket.id);
    const myRank = leaderboard.findIndex(p => p.id === socket.id) + 1;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '40px';

    const h2 = document.createElement('h2');
    h2.style.color = '#facc15';
    h2.textContent = 'Fim de Jogo! 🏆';

    const p1 = document.createElement('p');
    p1.style.fontSize = '1.3rem';
    p1.style.fontWeight = 'bold';
    p1.style.color = '#38bdf8';
    p1.textContent = me ? `\({myRank}º Lugar (\){me.score} pts)` : 'Partida Encerrada';

    const p2 = document.createElement('p');
    p2.style.color = '#94a3b8';
    p2.textContent = 'Olhe para a TV para ver o pódio completo!';

    card.appendChild(h2);
    card.appendChild(p1);
    card.appendChild(p2);
    votingScreen.appendChild(card);
});