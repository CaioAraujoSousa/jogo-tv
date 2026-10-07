import { initCanvas } from './modules/canvasEngine.js?v=3';
import { renderVotingScreen } from './modules/votingEngine.js?v=3';

const socket = io();
let selectedAvatar = '🦊';
let isHost = false;
let isGameStarted = false;
let hasJoined = false;
let hasSubmittedCurrentRound = false;

// GERENCIADOR CENTRAL DE EXIBIÇÃO DE TELAS
function exibirTela(idTelaDesejada) {
    const telas = ['login-screen', 'waiting-screen', 'drawing-screen', 'voting-screen'];
    
    telas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    let telaAtiva = document.getElementById(idTelaDesejada);
    
    if (!telaAtiva && idTelaDesejada === 'voting-screen') {
        telaAtiva = document.createElement('div');
        telaAtiva.id = 'voting-screen';
        document.body.appendChild(telaAtiva);
    }

    if (telaAtiva) {
        telaAtiva.style.display = 'block';
    }
}

// SELEÇÃO DE AVATAR
document.querySelectorAll('.avatar-option').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-option').forEach(a => a.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatar = e.target.getAttribute('data-avatar');
    });
});

// ENTRAR NO JOGO
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

// ATUALIZAÇÃO DO LOBBY
// ATUALIZAÇÃO DO LOBBY
socket.on('update-lobby', (players) => {
    const me = players.find(p => p.id === socket.id);
    hasJoined = !!me;

    if (!me) return;

    isHost = players.length > 0 && players[0].id === socket.id;

    if (isGameStarted) return;

    exibirTela('waiting-screen');

    document.getElementById('user-display').innerText = me.avatar;
    document.getElementById('welcome-name').innerText = me.name;

    if (isHost) {
        document.getElementById('host-controls').style.display = 'block';
        document.getElementById('waiting-msg').style.display = 'none';
        
        // RESETA O BOTÃO DO ANFITRIÃO PARA PARTIDAS EM SEQUÊNCIA
        const startBtn = document.getElementById('start-btn-mobile');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = 'Iniciar Partida';
        }
    } else {
        document.getElementById('host-controls').style.display = 'none';
        document.getElementById('waiting-msg').style.display = 'block';
        document.getElementById('waiting-msg').innerText = 'Aguardando ' + players[0].name + ' iniciar a partida...';
    }
});

// BOTAO INICIAR (ANFITRIÃO)
document.getElementById('start-btn-mobile').addEventListener('click', (e) => {
    e.target.disabled = true;
    e.target.innerText = 'Iniciando partida... ⏳';
    socket.emit('start-game');
});

// FUNÇÃO CENTRALIZADA DE ENVIO (MANUAL E AUTOMÁTICA)
function enviarDesenhoAtual() {
    if (hasSubmittedCurrentRound) return;
    hasSubmittedCurrentRound = true;

    const canvas = document.getElementById('paintCanvas');
    if (canvas) {
        const imageData = canvas.toDataURL('image/jpeg', 0.5);
        socket.emit('submit-drawing', imageData);
    }

    const drawingScreen = document.getElementById('drawing-screen');
    if (drawingScreen) {
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
    }
}

// FASE DE DESENHO (OUVINTE ÚNICO)
socket.on('start-round', (data) => {
    if (!hasJoined) return;
    isGameStarted = true;
    hasSubmittedCurrentRound = false; // Reseta a trava da nova rodada
    exibirTela('drawing-screen');

    const drawingScreen = document.getElementById('drawing-screen');
    drawingScreen.innerHTML = '';

    const themeBox = document.createElement('div');
    themeBox.className = 'theme-box';

    const roundSpan = document.createElement('span');
    roundSpan.style.fontSize = '0.85rem';
    roundSpan.style.color = '#94a3b8';
    roundSpan.textContent = 'Rodada ' + data.round + ' de 6 - TEMA:';

    const themeTitle = document.createElement('h3');
    themeTitle.id = 'my-theme';
    themeTitle.style.margin = '5px 0';
    themeTitle.style.color = '#facc15';
    themeTitle.textContent = data.theme;

    themeBox.appendChild(roundSpan);
    themeBox.appendChild(themeTitle);

    const paletteBox = document.createElement('div');
    paletteBox.className = 'palette-box';

    const toolsBox = document.createElement('div');
    toolsBox.className = 'tools-box';

    const canvas = document.createElement('canvas');
    canvas.id = 'paintCanvas';
    canvas.width = 310;
    canvas.height = 330;

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-btn';
    clearBtn.style.background = '#ef4444';
    clearBtn.textContent = 'Limpar Tudo';

    const submitBtn = document.createElement('button');
    submitBtn.id = 'submit-btn';
    submitBtn.style.background = '#22c55e';
    submitBtn.textContent = 'Enviar Desenho';

    toolbar.appendChild(clearBtn);
    toolbar.appendChild(submitBtn);

    drawingScreen.appendChild(themeBox);
    drawingScreen.appendChild(paletteBox);
    drawingScreen.appendChild(toolsBox);
    drawingScreen.appendChild(canvas);
    drawingScreen.appendChild(toolbar);

    initCanvas(canvas, clearBtn, submitBtn, socket, paletteBox, toolsBox);

    submitBtn.addEventListener('click', () => {
        enviarDesenhoAtual();
    });
});

// OUVINTE DO TEMPORIZADOR COM AUTO-SUBMIT
socket.on('timer-tick', (timeLeft) => {
    let timerEl = document.getElementById('game-timer');

    if (!timerEl) {
        timerEl = document.createElement('div');
        timerEl.id = 'game-timer';
        timerEl.style.position = 'fixed';
        timerEl.style.top = '10px';
        timerEl.style.right = '15px';
        timerEl.style.fontWeight = 'bold';
        timerEl.style.fontSize = '1rem';
        timerEl.style.color = '#facc15';
        timerEl.style.background = '#1e293b';
        timerEl.style.padding = '6px 12px';
        timerEl.style.borderRadius = '20px';
        timerEl.style.border = '1px solid #38bdf8';
        timerEl.style.zIndex = '9999';
        timerEl.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
        document.body.appendChild(timerEl);
    }

    timerEl.style.display = 'block';
    timerEl.textContent = '⏱️ ' + timeLeft + 's';

    if (timeLeft <= 10) {
        timerEl.style.color = '#ef4444';
        timerEl.style.borderColor = '#ef4444';
    } else {
        timerEl.style.color = '#facc15';
        timerEl.style.borderColor = '#38bdf8';
    }

    // Auto-submit no último segundo se ainda não enviou
    const drawingScreen = document.getElementById('drawing-screen');
    const isDrawingActive = drawingScreen && drawingScreen.style.display !== 'none';

    if (timeLeft <= 0 && isDrawingActive && !hasSubmittedCurrentRound) {
        enviarDesenhoAtual();
    }
});

// FASE DE VOTAÇÃO
socket.on('start-voting-round', (data) => {
    if (!hasJoined) return;
    isGameStarted = true;
    exibirTela('voting-screen');

    const votingScreen = document.getElementById('voting-screen');
    if (votingScreen) {
        votingScreen.innerHTML = '';
        renderVotingScreen(votingScreen, data, socket);
    }
});

// FIM DE JOGO
socket.on('game-over', (leaderboard) => {
    if (!hasJoined) return;

    isGameStarted = true;
    exibirTela('voting-screen');

    const timerEl = document.getElementById('game-timer');
    if (timerEl) timerEl.style.display = 'none';

    const votingScreen = document.getElementById('voting-screen');
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

    if (me) {
        p1.textContent = myRank + 'º Lugar (' + me.score + ' pts)';
    } else {
        p1.textContent = 'Partida Encerrada';
    }

    const p2 = document.createElement('p');
    p2.style.color = '#94a3b8';
    p2.textContent = 'Olhe para a TV para ver o pódio completo!';

    card.appendChild(h2);
    card.appendChild(p1);
    card.appendChild(p2);

    if (isHost) {
        const restartBtn = document.createElement('button');
        restartBtn.style.marginTop = '20px';
        restartBtn.style.background = '#22c55e';
        restartBtn.textContent = 'Voltar ao Lobby 🔄';
        restartBtn.addEventListener('click', () => {
            socket.emit('return-to-lobby');
        });
        card.appendChild(restartBtn);
    }

    votingScreen.appendChild(card);
});

// RETORNO AO LOBBY
// RETORNO AO LOBBY
socket.on('back-to-lobby', (players) => {
    isGameStarted = false;
    const timerEl = document.getElementById('game-timer');
    if (timerEl) timerEl.style.display = 'none';

    const me = players.find(p => p.id === socket.id);

    if (me) {
        hasJoined = true;
        exibirTela('waiting-screen');
        isHost = players.length > 0 && players[0].id === socket.id;
        
        document.getElementById('host-controls').style.display = isHost ? 'block' : 'none';
        document.getElementById('waiting-msg').style.display = isHost ? 'none' : 'block';
        
        // RESETA O BOTÃO DO ANFITRIÃO AO VOLTAR DA PARTIDA ANTERIOR
        const startBtn = document.getElementById('start-btn-mobile');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = 'Iniciar Partida';
        }

        if (!isHost) {
            document.getElementById('waiting-msg').innerText = 'Aguardando ' + players[0].name + ' iniciar a partida...';
        }
    } else {
        hasJoined = false;
        exibirTela('login-screen');
    }
});