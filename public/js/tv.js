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

socket.on('show-presentation', (data) => {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('presentation-screen').style.display = 'block';

    const container = document.getElementById('presentation-container');
    container.innerHTML = '';

    let slides = [];
    data.rounds.forEach((roundNum, index) => {
        const theme = data.themes[index];
        const roundDrawings = data.drawings[roundNum] || {};

        for (let playerId in roundDrawings) {
            const player = data.players.find(p => p.id === playerId);
            slides.push({
                round: roundNum,
                theme: theme,
                player: player ? player.name : 'Jogador Desconhecido',
                avatar: player ? player.avatar : '🎨',
                image: roundDrawings[playerId]
            });
        }
    });

    let currentSlideIndex = 0;

    function renderSlide() {
        if (currentSlideIndex >= slides.length) {
            container.innerHTML = `<h3 style="color: #38bdf8; margin-top: 40px;">Fim da apresentação deste bloco! Próxima fase em breve...</h3>`;
            return;
        }

        const slide = slides[currentSlideIndex];
        container.innerHTML = `
            <div class="drawing-card">
                <p style="color: #94a3b8; margin: 0; font-size: 1rem;">Rodada ${slide.round} • Tema:</p>
                <h3 style="color: #facc15; margin: 8px 0 15px 0; font-size: 1.6rem;">${slide.theme}</h3>
                <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 5px;">\({slide.avatar}\){slide.player}</div>
                <img src="${slide.image}" alt="Desenho">
                <button class="next-presentation-btn" id="next-slide-btn">Seguinte ➔</button>
            </div>
        `;

        document.getElementById('next-slide-btn').addEventListener('click', () => {
            currentSlideIndex++;
            renderSlide();
        });
    }

    renderSlide();
});