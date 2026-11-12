export function initCanvas(
  canvasElement,
  clearBtn,
  paletteContainer,
  toolContainer,
) {
  const ctx = canvasElement.getContext("2d", { willReadFrequently: true });
  let painting = false;

  // Estado das Ferramentas
  let currentColor = "#0f172a";
  let currentLineWidth = 2.5;
  let isEraser = false;
  let isBucket = false;

  // Histórico de traços (cada item é uma foto do canvas antes da ação)
  const history = [];
  const MAX_HISTORY = 20;

  // Fundo Branco Inicial
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function saveHistory() {
    history.push(
      ctx.getImageData(0, 0, canvasElement.width, canvasElement.height),
    );
    if (history.length > MAX_HISTORY) history.shift();
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }

  // Algoritmo Flood Fill (Balde de Tinta) com tolerância para bordas suaves
  function floodFill(startX, startY, fillHex) {
    const width = canvasElement.width;
    const height = canvasElement.height;
    const x0 = Math.floor(startX);
    const y0 = Math.floor(startY);

    if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const startIdx = (y0 * width + x0) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];

    const fillRgb = hexToRgb(fillHex);

    // Se a cor clicada já for praticamente igual à cor do balde, não faz nada
    if (
      Math.abs(startR - fillRgb.r) < 10 &&
      Math.abs(startG - fillRgb.g) < 10 &&
      Math.abs(startB - fillRgb.b) < 10
    ) {
      return;
    }

    saveHistory();

    const tolerance = 55;
    const visited = new Uint8Array(width * height);
    const stack = [x0 + y0 * width];
    visited[x0 + y0 * width] = 1;

    while (stack.length > 0) {
      const pos = stack.pop();
      const x = pos % width;
      const y = (pos - x) / width;
      const idx = pos * 4;

      data[idx] = fillRgb.r;
      data[idx + 1] = fillRgb.g;
      data[idx + 2] = fillRgb.b;
      data[idx + 3] = 255;

      // Vizinhos: Direita, Esquerda, Baixo, Cima
      const neighbors = [];
      if (x + 1 < width) neighbors.push(pos + 1);
      if (x - 1 >= 0) neighbors.push(pos - 1);
      if (y + 1 < height) neighbors.push(pos + width);
      if (y - 1 >= 0) neighbors.push(pos - width);

      for (let i = 0; i < neighbors.length; i++) {
        const nPos = neighbors[i];
        if (visited[nPos]) continue;

        const nIdx = nPos * 4;
        const dr = Math.abs(data[nIdx] - startR);
        const dg = Math.abs(data[nIdx + 1] - startG);
        const db = Math.abs(data[nIdx + 2] - startB);

        if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
          visited[nPos] = 1;
          stack.push(nPos);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function getPos(e) {
    const rect = canvasElement.getBoundingClientRect();
    const clientX =
      e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY =
      e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

    const scaleX = canvasElement.width / rect.width;
    const scaleY = canvasElement.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    const pos = getPos(e);

    if (isBucket) {
      floodFill(pos.x, pos.y, currentColor);
      return;
    }

    saveHistory();
    painting = true;

    ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
    ctx.lineWidth = isEraser ? 14 : currentLineWidth;

    // Pingo imediato no toque
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = isEraser ? "#ffffff" : currentColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function stopDraw() {
    painting = false;
    ctx.beginPath();
  }

  function draw(e) {
    if (!painting || isBucket) return;
    const pos = getPos(e);

    ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
    ctx.lineWidth = isEraser ? 14 : currentLineWidth;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  // Eventos de Mouse
  canvasElement.addEventListener("mousedown", startDraw);
  canvasElement.addEventListener("mouseup", stopDraw);
  canvasElement.addEventListener("mouseleave", stopDraw);
  canvasElement.addEventListener("mousemove", draw);

  // Eventos de Toque (Celular)
  canvasElement.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startDraw(e);
  });
  canvasElement.addEventListener("touchend", (e) => {
    e.preventDefault();
    stopDraw();
  });
  canvasElement.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    stopDraw();
  });
  canvasElement.addEventListener("touchmove", (e) => {
    e.preventDefault();
    draw(e);
  });

  // Botão Desfazer (volta o último traço ou balde)
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const last = history.pop();
      if (last) ctx.putImageData(last, 0, 0);
    });
  }

  // Criar os botões da Paleta de Cores
  if (paletteContainer) {
    paletteContainer.innerHTML = "";
    const colors = [
      "#0f172a",
      "#ef4444",
      "#3b82f6",
      "#22c55e",
      "#f59e0b",
      "#a855f7",
      "#ec4899",
      "#78350f",
    ];

    colors.forEach((color, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-btn" + (index === 0 ? " selected" : "");
      btn.style.backgroundColor = color;

      btn.addEventListener("click", () => {
        isEraser = false;
        currentColor = color;
        if (toolContainer) {
          const eraserBtn = toolContainer.querySelector(".eraser-btn");
          if (eraserBtn) eraserBtn.classList.remove("active");
        }
        paletteContainer
          .querySelectorAll(".color-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });

      paletteContainer.appendChild(btn);
    });
  }

  // Criar os botões de Borracha e Balde lado a lado
  if (toolContainer) {
    toolContainer.innerHTML = "";

    const eraserBtn = document.createElement("button");
    eraserBtn.type = "button";
    eraserBtn.className = "eraser-btn";
    eraserBtn.textContent = "🧹 Borracha";

    const bucketBtn = document.createElement("button");
    bucketBtn.type = "button";
    bucketBtn.className = "bucket-btn";
    bucketBtn.textContent = "🪣 Balde";

    eraserBtn.addEventListener("click", () => {
      isEraser = !isEraser;
      if (isEraser) {
        isBucket = false;
        bucketBtn.classList.remove("active");
        eraserBtn.classList.add("active");
        if (paletteContainer) {
          paletteContainer
            .querySelectorAll(".color-btn")
            .forEach((b) => b.classList.remove("selected"));
        }
      } else {
        eraserBtn.classList.remove("active");
      }
    });

    bucketBtn.addEventListener("click", () => {
      isBucket = !isBucket;
      if (isBucket) {
        isEraser = false;
        eraserBtn.classList.remove("active");
        bucketBtn.classList.add("active");
        // Garante que a cor atual continue destacada na paleta
        if (paletteContainer) {
          const hasSelected = paletteContainer.querySelector(".color-btn.selected");
          if (!hasSelected) {
            const firstColor = paletteContainer.querySelector(".color-btn");
            if (firstColor) firstColor.classList.add("selected");
          }
        }
      } else {
        bucketBtn.classList.remove("active");
      }
    });

    toolContainer.appendChild(eraserBtn);
    toolContainer.appendChild(bucketBtn);
  }
}