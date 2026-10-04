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
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
    
    // Calcula a proporção entre o tamanho visual na tela e a resolução interna do canvas
    const scaleX = canvasElement.width / rect.width;
    const scaleY = canvasElement.height / rect.height;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
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
    canvasElement.addEventListener('mouseleave', stopDraw); // ADICIONE ESSA LINHA
    canvasElement.addEventListener('mousemove', draw);

// Eventos de Toque (Celular)
    canvasElement.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvasElement.addEventListener('touchend', (e) => { e.preventDefault(); stopDraw(); });
    canvasElement.addEventListener('touchcancel', (e) => { e.preventDefault(); stopDraw(); }); // ADICIONE ESSA LINHA
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
            submitBtn.disabled = true; // Desativa o botão imediatamente no clique
            submitBtn.style.opacity = '0.5';
        
            const imageData = canvasElement.toDataURL('image/png');
            socket.emit('submit-drawing', imageData);
        });
    }
}