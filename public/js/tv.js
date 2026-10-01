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

    if(players.length > 0) {
        document.getElementById('tv-status').innerText = `Aguardando ${players[0].name} (Anfitrião) iniciar a partida...`;
    } else {
        document.getElementById('tv-status').innerText = "Aponte a câmara do telemóvel para o QR Code para entrar na sala";
    }

    for (let i = 0; i < 8; i++) {
        const seatDiv = document.createElement('div');
        seatDiv.className = 'seat';
        if (players[i]) {
            seatDiv.classList.add('occupied');
            seatDiv.innerHTML = `
                <div class="avatar">${players[i].avatar}</div>
                <div class="name">${players[i].name}</div>
            `;
        } else {
            seatDiv.innerHTML = `<span>Lugar ${i + 1}</span><small style="margin-top:4px;">Vazio</small>`;
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

// Fase de Votação por Rodada: Exibe todos os desenhos lado a lado com números e cores
socket.on('start-voting-round', (data) => {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('presentation-screen').style.display = 'block';

    const container = document.getElementById('presentation-container');
    
    let html = `
        <div style="margin-bottom: 25px;">
            <p style="color: #94a3b8; font-size: 1.2rem; margin: 0;">Rodada ${data.round} de 6 • Votação</p>
            <h1 style="color: #facc15; font-size: 2.2rem; margin: 5px 0 15px 0;">${data.theme}</h1>
            <p style="color: #38bdf8; font-size: 1.1rem; margin: 0;">Vote no telemóvel na ordem dos seus desenhos favoritos!</p>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; width: 100%; max-width: 1100px; margin: 0 auto;">
    `;

    data.cards.forEach((card) => {
        html += `
            <div style="background: #1e293b; padding: 15px; border-radius: 16px; border: 3px solid ${card.color}; display: flex; flex-direction: column; align-items: center; box-shadow: 0 8px 20px rgba(0,0,0,0.4); width: 220px;">
                <div style="background: ${card.color}; color: #ffffff; font-size: 1.8rem; font-weight: bold; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    ${card.number}
                </div>
                <img src="\({card.imageData}" alt="Desenho\){card.number}" style="background: white; border-radius: 10px; width: 100%; height: 240px; object-fit: contain;" />
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
});