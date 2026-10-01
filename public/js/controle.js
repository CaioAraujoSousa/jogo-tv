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

socket.on('start-round', (data) => {
    document.getElementById('waiting-screen').style.display = 'none';
    const votingScreen = document.getElementById('voting-screen');
    if (votingScreen) votingScreen.style.display = 'none';
    
    document.getElementById('drawing-screen').style.display = 'block';
    
    document.getElementById('drawing-screen').innerHTML = `
        <div class="theme-box">
            <span style="font-size: 0.85rem; color: #94a3b8;">Rodada ${data.round} de 6 - TEMA:</span>
            <h3 id="my-theme" style="margin: 5px 0; color: #facc15;">${data.theme}</h3>
        </div>
        <canvas id="paintCanvas" width="320" height="380"></canvas>
        <div class="toolbar">
            <button id="clear-btn" style="background: #ef4444;">Limpar</button>
            <button id="submit-btn" style="background: #22c55e;">Enviar Desenho</button>
        </div>
    `;
    initCanvas();
});

let canvas, ctx, painting = false;

function initCanvas() {
    canvas = document.getElementById('paintCanvas');
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', finishedPosition);
    canvas.addEventListener('mousemove', draw);

    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startPosition(e.touches[0]); });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); finishedPosition(); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });

    document.getElementById('clear-btn').addEventListener('click', () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById('submit-btn').addEventListener('click', () => {
        const imageData = canvas.toDataURL('image/png');
        socket.emit('submit-drawing', imageData);
        
        document.getElementById('drawing-screen').innerHTML = `
            <div class="card" style="margin-top: 50px;">
                <h2>Desenho Enviado! 🚀</h2>
                <p style="color: #94a3b8; font-size: 1rem;">Aguardando os outros jogadores terminarem...</p>
            </div>
        `;
    });
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function startPosition(e) { painting = true; draw(e); }
function finishedPosition() { painting = false; ctx.beginPath(); }
function draw(e) {
    if (!painting) return;
    const pos = getMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

// --- FASE DE VOTAÇÃO (TOP N-1) ---
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

    const totalCards = data.cards.length;
    const maxVotes = Math.max(1, totalCards - 1); // Top N-1
    let selectedVotes = [];

    function renderVotingUI() {
        let html = `
            <div class="card">
                <h2 style="color: #facc15; margin-bottom: 5px;">Votação • Rodada ${data.round}</h2>
                <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0;">Escolha os seus favoritos por ordem (\({selectedVotes.length}/\){maxVotes})</p>
                
                <div class="vote-grid">
        `;

        data.cards.forEach((card) => {
            const isMyDrawing = (card.artistId === socket.id);
            const voteIndex = selectedVotes.indexOf(card.number);
            const isSelected = (voteIndex !== -1);

            let btnClass = 'vote-btn';
            if (isMyDrawing) btnClass += ' disabled';

            let style = `background-color: ${card.color};`;
            if (isMyDrawing) {
                style = '';
            }

            let badge = '';
            if (isMyDrawing) {
                badge = '<span class="vote-badge">Seu</span>';
            } else if (isSelected) {
                badge = `<span class="vote-badge">${voteIndex + 1}º Lugar</span>`;
            }

            html += `
                <button class="\({btnClass}" style="\){style}" data-number="\({card.number}"\){isMyDrawing ? 'disabled' : ''}>
                    <span>Desenho ${card.number}</span>
                    ${badge}
                </button>
            `;
        });

        const remainingVotes = maxVotes - selectedVotes.length;
        const btnText = selectedVotes.length === maxVotes 
            ? 'Confirmar Votos 🚀' 
            : `Selecione ${remainingVotes} preferência(s)`;

        html += `
                </div>
                <button id="send-vote-btn" style="margin-top: 15px; background: #22c55e;" ${selectedVotes.length === maxVotes ? '' : 'disabled style="opacity:0.5; background:#64748b;"'}>
                    ${btnText}
                </button>
            </div>
        `;

        votingScreen.innerHTML = html;

        votingScreen.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.getAttribute('data-number'));
                if (isNaN(num)) return;

                const idx = selectedVotes.indexOf(num);
                if (idx !== -1) {
                    selectedVotes.splice(idx, 1);
                } else {
                    if (selectedVotes.length < maxVotes) {
                        selectedVotes.push(num);
                    }
                }
                renderVotingUI();
            });
        });

        const sendBtn = document.getElementById('send-vote-btn');
        if (sendBtn && selectedVotes.length === maxVotes) {
            sendBtn.addEventListener('click', () => {
                socket.emit('submit-votes', { round: data.round, votes: selectedVotes });
                votingScreen.innerHTML = `
                    <div class="card" style="margin-top: 50px;">
                        <h2>Votos Enviados! 🎯</h2>
                        <p style="color: #94a3b8; font-size: 1rem;">Aguardando os restantes jogadores votarem...</p>
                    </div>
                `;
            });
        }
    }

    renderVotingUI();
});