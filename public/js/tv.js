const socket = io();
const controlUrl = window.location.origin + '/controle.html';
document.getElementById('room-url').innerText = controlUrl;
new QRCode(document.getElementById("qrcode"), {
    text: controlUrl,
    width: 150,
    height: 150
});

const seatsGrid = document.getElementById('seats-grid');

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

socket.on('update-lobby', (players) => {
    renderSeats(players);
});

socket.on('start-round', (data) => {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('presentation-screen').style.display = 'none';
    document.getElementById('round-number').innerText = data.round;
    document.getElementById('theme-display').innerText = data.theme;
});

// Fase de Votação por Rodada (Grelha com DOM puro - 0 erros de renderização)
socket.on('start-voting-round', (data) => {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('presentation-screen').style.display = 'block';

    const container = document.getElementById('presentation-container');
    container.innerHTML = '';

    // Cabeçalho
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

    // Grelha de desenhos
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

        // Círculo com o Número
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

        // Imagem do Desenho
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