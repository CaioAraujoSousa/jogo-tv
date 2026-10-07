const socket = io();
const controlUrl = window.location.origin + '/controle.html';
let isGameStarted = false;

// QR CODE DA SALA
document.getElementById('room-url').innerText = controlUrl;
new QRCode(document.getElementById("qrcode"), {
    text: controlUrl,
    width: 150,
    height: 150
});

const seatsGrid = document.getElementById('seats-grid');

// GERENCIADOR CENTRAL DE TELAS DA TV
function exibirTelaTV(idTelaDesejada) {
    const telas = ['lobby-screen', 'game-screen', 'presentation-screen'];
    telas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const telaAtiva = document.getElementById(idTelaDesejada);
    if (telaAtiva) {
        telaAtiva.style.display = 'block';
    }
}

// RENDERIZAÇÃO DOS LUGARES / ASSENTOS NO LOBBY
function renderSeats(players) {
    seatsGrid.innerHTML = '';
    document.getElementById('player-count').innerText = players.length;

    if (players.length > 0) {
        document.getElementById('tv-status').innerText = `Aguardando ${players[0].name} (Anfitrião) iniciar a partida...`;
    } else {
        document.getElementById('tv-status').innerText = "Aponte a câmara do telemóvel para o QR Code para entrar na sala";
    }

    for (let i = 0; i < 8; i++) {
        const seatDiv = document.createElement('div');
        seatDiv.className = 'seat';
        if (players[i]) {
            seatDiv.classList.add('occupied');
            
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar';
            avatarDiv.textContent = players[i].avatar;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'name';
            nameDiv.textContent = players[i].name;

            seatDiv.appendChild(avatarDiv);
            seatDiv.appendChild(nameDiv);
        } else {
            const seatSpan = document.createElement('span');
            seatSpan.textContent = `Lugar ${i + 1}`;

            const smallTag = document.createElement('small');
            smallTag.style.marginTop = '4px';
            smallTag.textContent = 'Vazio';

            seatDiv.appendChild(seatSpan);
            seatDiv.appendChild(smallTag);
        }
        seatsGrid.appendChild(seatDiv);
    }
}

renderSeats([]);

// ATUALIZAÇÃO DO LOBBY
socket.on('update-lobby', (players) => {
    renderSeats(players);

    if (!isGameStarted) {
        exibirTelaTV('lobby-screen');
    }
});

// FASE DE DESENHO
socket.on('start-round', (data) => {
    isGameStarted = true;
    exibirTelaTV('game-screen');

    document.getElementById('round-number').innerText = data.round;
    document.getElementById('theme-display').innerText = data.theme;

    // Reseta mensagem de progresso de envio
    const progressEl = document.getElementById('drawing-progress-display');
    if (progressEl) {
        progressEl.innerText = 'Aguardando desenhos...';
    }
});

// PROGRESSO DE ENVIO DOS DESENHOS
socket.on('drawing-progress', (data) => {
    let progressEl = document.getElementById('drawing-progress-display');
    if (!progressEl) {
        progressEl = document.createElement('div');
        progressEl.id = 'drawing-progress-display';
        progressEl.style.marginTop = '15px';
        progressEl.style.fontSize = '1.3rem';
        progressEl.style.color = '#38bdf8';
        progressEl.style.fontWeight = 'bold';

        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) gameScreen.appendChild(progressEl);
    }
    progressEl.innerText = `🎨 ${data.submitted} de ${data.total} desenhos recebidos`;
});

// TEMPORIZADOR VISUAL DA TV
socket.on('timer-tick', (timeLeft) => {
    let tvTimer = document.getElementById('tv-timer-display');

    if (!tvTimer) {
        tvTimer = document.createElement('div');
        tvTimer.id = 'tv-timer-display';
        tvTimer.style.position = 'fixed';
        tvTimer.style.top = '20px';
        tvTimer.style.right = '30px';
        tvTimer.style.fontSize = '2rem';
        tvTimer.style.fontWeight = 'bold';
        tvTimer.style.color = '#facc15';
        tvTimer.style.background = '#1e293b';
        tvTimer.style.padding = '10px 22px';
        tvTimer.style.borderRadius = '16px';
        tvTimer.style.border = '2px solid #38bdf8';
        tvTimer.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.4)';
        tvTimer.style.zIndex = '99999';
        document.body.appendChild(tvTimer);
    }

    tvTimer.style.display = 'block';
    tvTimer.textContent = '⏱️ ' + timeLeft + 's';

    if (timeLeft <= 10) {
        tvTimer.style.color = '#ef4444';
        tvTimer.style.borderColor = '#ef4444';
    } else {
        tvTimer.style.color = '#facc15';
        tvTimer.style.borderColor = '#38bdf8';
    }
});

// FASE DE VOTAÇÃO (APRESENTAÇÃO DOS DESENHOS)
socket.on('start-voting-round', (data) => {
    isGameStarted = true;
    exibirTelaTV('presentation-screen');

    const container = document.getElementById('presentation-container');
    container.innerHTML = '';

    const headerDiv = document.createElement('div');
    headerDiv.style.marginBottom = '25px';

    const roundP = document.createElement('p');
    roundP.style.color = '#94a3b8';
    roundP.style.fontSize = '1.2rem';
    roundP.style.margin = '0';
    roundP.textContent = `Rodada ${data.round} de 6 • Votação`;

    const themeH1 = document.createElement('h1');
    themeH1.style.color = '#facc15';
    themeH1.style.fontSize = '2.2rem';
    themeH1.style.margin = '5px 0 15px 0';
    themeH1.textContent = data.theme;

    const instructionP = document.createElement('p');
    instructionP.style.color = '#38bdf8';
    instructionP.style.fontSize = '1.1rem';
    instructionP.style.margin = '0';
    instructionP.textContent = 'Vote no celular na ordem dos seus desenhos favoritos!';

    headerDiv.appendChild(roundP);
    headerDiv.appendChild(themeH1);
    headerDiv.appendChild(instructionP);

    const gridDiv = document.createElement('div');
    gridDiv.style.display = 'flex';
    gridDiv.style.flexWrap = 'wrap';
    gridDiv.style.gap = '20px';
    gridDiv.style.justifyContent = 'center';
    gridDiv.style.width = '100%';
    gridDiv.style.maxWidth = '1100px';
    gridDiv.style.margin = '0 auto';

    data.cards.forEach((card) => {
        const cardDiv = document.createElement('div');
        cardDiv.style.background = '#1e293b';
        cardDiv.style.padding = '15px';
        cardDiv.style.borderRadius = '16px';
        cardDiv.style.border = `3px solid ${card.color}`;
        cardDiv.style.display = 'flex';
        cardDiv.style.flexDirection = 'column';
        cardDiv.style.alignItems = 'center';
        cardDiv.style.boxShadow = '0 8px 20px rgba(0,0,0,0.4)';
        cardDiv.style.width = '220px';

        const numCircle = document.createElement('div');
        numCircle.style.background = card.color;
        numCircle.style.color = '#ffffff';
        numCircle.style.fontSize = '1.8rem';
        numCircle.style.fontWeight = 'bold';
        numCircle.style.width = '50px';
        numCircle.style.height = '50px';
        numCircle.style.borderRadius = '50%';
        numCircle.style.display = 'flex';
        numCircle.style.alignItems = 'center';
        numCircle.style.justifyContent = 'center';
        numCircle.style.marginBottom = '12px';
        numCircle.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
        numCircle.textContent = card.number;

        const img = document.createElement('img');
        img.src = card.imageData;
        img.alt = `Desenho ${card.number}`;
        img.style.background = 'white';
        img.style.borderRadius = '10px';
        img.style.width = '100%';
        img.style.height = '240px';
        img.style.objectFit = 'contain';

        cardDiv.appendChild(numCircle);
        cardDiv.appendChild(img);
        gridDiv.appendChild(cardDiv);
    });

    container.appendChild(headerDiv);
    container.appendChild(gridDiv);
});

// FIM DE JOGO (PÓDIO FINAL)
socket.on('game-over', (leaderboard) => {
    isGameStarted = true;
    
    const tvTimer = document.getElementById('tv-timer-display');
    if (tvTimer) tvTimer.style.display = 'none';

    exibirTelaTV('presentation-screen');

    const container = document.getElementById('presentation-container');
    container.innerHTML = '';

    const titleH1 = document.createElement('h1');
    titleH1.style.color = '#facc15';
    titleH1.style.fontSize = '3rem';
    titleH1.style.marginBottom = '20px';
    titleH1.textContent = '🏆 Pódio Final 🏆';

    const podiumWrapper = document.createElement('div');
    podiumWrapper.className = 'podium-container';

    const first = leaderboard[0];
    const second = leaderboard[1];
    const third = leaderboard[2];

    if (second) podiumWrapper.appendChild(createPillar(second, 2, 'silver'));
    if (first) podiumWrapper.appendChild(createPillar(first, 1, 'gold'));
    if (third) podiumWrapper.appendChild(createPillar(third, 3, 'bronze'));

    container.appendChild(titleH1);
    container.appendChild(podiumWrapper);

    if (leaderboard.length > 3) {
        const restList = document.createElement('div');
        restList.className = 'rest-leaderboard';
        for (let i = 3; i < leaderboard.length; i++) {
            const p = leaderboard[i];
            const row = document.createElement('div');
            row.className = 'rest-row';
            row.textContent = `${i + 1}º ${p.avatar} ${p.name} - ${p.score} pts`;
            restList.appendChild(row);
        }
        container.appendChild(restList);
    }
});

function createPillar(player, rank, type) {
    const pillar = document.createElement('div');
    pillar.className = `podium-pillar ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'podium-avatar';
    avatar.textContent = player.avatar;

    const badge = document.createElement('div');
    badge.className = 'podium-rank-badge';
    badge.textContent = rank;

    const name = document.createElement('div');
    name.className = 'podium-name';
    name.textContent = player.name;

    const score = document.createElement('div');
    score.className = 'podium-score';
    score.textContent = `${player.score} pts`;

    pillar.appendChild(avatar);
    pillar.appendChild(badge);
    pillar.appendChild(name);
    pillar.appendChild(score);
    return pillar;
}

// RETORNO AO LOBBY
socket.on('back-to-lobby', (players) => {
    isGameStarted = false;

    const tvTimer = document.getElementById('tv-timer-display');
    if (tvTimer) tvTimer.style.display = 'none';

    exibirTelaTV('lobby-screen');
    renderSeats(players);
});