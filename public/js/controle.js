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