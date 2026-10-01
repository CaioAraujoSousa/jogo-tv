export function initCanvas(canvasElement, clearBtn, submitBtn, socket) {
    const ctx = canvasElement.getContext('2d');
    let painting = false;

    // Configuração inicial do pincel e fundo
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    function getPos(e) {
        const rect = canvasElement.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDraw(e) {
        painting = true;
        draw(e);
    }

    function stopDraw() {
        painting = false;
        ctx.beginPath();
    }

    function draw(e) {
        if (!painting) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    // Eventos de Mouse
    canvasElement.addEventListener('mousedown', startDraw);
    canvasElement.addEventListener('mouseup', stopDraw);
    canvasElement.addEventListener('mousemove', draw);

    // Eventos de Toque (Celular)
    canvasElement.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvasElement.addEventListener('touchend', (e) => { e.preventDefault(); stopDraw(); });
    canvasElement.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });

    // Botão Limpar
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        });
    }

    // Botão Enviar
    if (submitBtn && socket) {
        submitBtn.addEventListener('click', () => {
            const imageData = canvasElement.toDataURL('image/png');
            socket.emit('submit-drawing', imageData);
        });
    }
}