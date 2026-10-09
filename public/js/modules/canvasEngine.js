export function initCanvas(canvasElement, clearBtn, paletteContainer, toolContainer) {
    const ctx = canvasElement.getContext('2d');
    let painting = false;

    // Estado do Pincel
    let currentColor = '#0f172a';
    let currentLineWidth = 2.5;
    let isEraser = false;

    // Fundo Branco Inicial
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e) {
        const rect = canvasElement.getBoundingClientRect();
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
        
        const scaleX = canvasElement.width / rect.width;
        const scaleY = canvasElement.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startDraw(e) {
        painting = true;
        const pos = getPos(e);

        ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
        ctx.lineWidth = isEraser ? 14 : currentLineWidth;

        // Pingo imediato no toque
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = isEraser ? '#ffffff' : currentColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function stopDraw() {
        painting = false;
        ctx.beginPath();
    }

    function draw(e) {
        if (!painting) return;
        const pos = getPos(e);

        ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
        ctx.lineWidth = isEraser ? 14 : currentLineWidth;

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    // Eventos de Mouse
    canvasElement.addEventListener('mousedown', startDraw);
    canvasElement.addEventListener('mouseup', stopDraw);
    canvasElement.addEventListener('mouseleave', stopDraw);
    canvasElement.addEventListener('mousemove', draw);

    // Eventos de Toque (Celular)
    canvasElement.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvasElement.addEventListener('touchend', (e) => { e.preventDefault(); stopDraw(); });
    canvasElement.addEventListener('touchcancel', (e) => { e.preventDefault(); stopDraw(); });
    canvasElement.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });

    // Botão Limpar Tudo
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        });
    }

    // Criar os botões da Paleta de Cores
    if (paletteContainer) {
        paletteContainer.innerHTML = '';
        const colors = ['#0f172a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#78350f'];

        colors.forEach((color, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-btn' + (index === 0 ? ' selected' : '');
            btn.style.backgroundColor = color;

            btn.addEventListener('click', () => {
                isEraser = false;
                currentColor = color;
                if (toolContainer) {
                    const eraserBtn = toolContainer.querySelector('.eraser-btn');
                    if (eraserBtn) eraserBtn.classList.remove('active');
                }
                paletteContainer.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });

            paletteContainer.appendChild(btn);
        });
    }

    // Criar o botão da Borracha
    if (toolContainer) {
        toolContainer.innerHTML = '';

        const eraserBtn = document.createElement('button');
        eraserBtn.type = 'button';
        eraserBtn.className = 'eraser-btn';
        eraserBtn.textContent = '🧹 Borracha';

        eraserBtn.addEventListener('click', () => {
            isEraser = !isEraser;
            if (isEraser) {
                eraserBtn.classList.add('active');
                if (paletteContainer) {
                    paletteContainer.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                }
            } else {
                eraserBtn.classList.remove('active');
            }
        });

        toolContainer.appendChild(eraserBtn);
    }
}