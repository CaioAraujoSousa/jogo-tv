export function initCanvas(
  canvasElement,
  clearBtn,
  paletteContainer,
  toolContainer,
) {
  const ctx = canvasElement.getContext("2d", { willReadFrequently: true });
  let painting = false;

  // Estado das Ferramentas: 'brush' | 'bucket' | 'eraser'
  let currentColor = "#0f172a";
  const MIN_SIZE = 1.5;
  const MAX_SIZE = 26;
  let currentLineWidth = MIN_SIZE; // Já começa no mais fino possível
  let activeTool = "brush";

  // Histórico de traços
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

  function closeSizePopup() {
    if (!toolContainer) return;
    const popup = toolContainer.querySelector(".size-popup");
    const sizeBtn = toolContainer.querySelector(".size-btn");
    if (popup) popup.classList.remove("open");
    if (sizeBtn) sizeBtn.classList.remove("active");
  }

  function startDraw(e) {
    closeSizePopup();
    const pos = getPos(e);

    if (activeTool === "bucket") {
      floodFill(pos.x, pos.y, currentColor);
      return;
    }

    saveHistory();
    painting = true;

    const isEraser = activeTool === "eraser";
    ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
    ctx.lineWidth = currentLineWidth;

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
    if (!painting || activeTool === "bucket") return;
    const pos = getPos(e);

    const isEraser = activeTool === "eraser";
    ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
    ctx.lineWidth = currentLineWidth;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  canvasElement.addEventListener("mousedown", startDraw);
  canvasElement.addEventListener("mouseup", stopDraw);
  canvasElement.addEventListener("mouseleave", stopDraw);
  canvasElement.addEventListener("mousemove", draw);

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

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      closeSizePopup();
      const last = history.pop();
      if (last) ctx.putImageData(last, 0, 0);
    });
  }

  function setActiveTool(toolName) {
    activeTool = toolName;
    if (!toolContainer) return;

    const brushBtn = toolContainer.querySelector(".brush-btn");
    const bucketBtn = toolContainer.querySelector(".bucket-btn");
    const eraserBtn = toolContainer.querySelector(".eraser-btn");

    if (brushBtn) brushBtn.classList.toggle("active", toolName === "brush");
    if (bucketBtn) bucketBtn.classList.toggle("active", toolName === "bucket");
    if (eraserBtn) eraserBtn.classList.toggle("active", toolName === "eraser");

    if (paletteContainer) {
      if (toolName === "eraser") {
        paletteContainer
          .querySelectorAll(".color-btn")
          .forEach((b) => b.classList.remove("selected"));
      } else {
        const hasSelected = paletteContainer.querySelector(
          ".color-btn.selected",
        );
        if (!hasSelected) {
          const activeColorBtn = paletteContainer.querySelector(
            `[data-color="${currentColor}"]`,
          );
          if (activeColorBtn) activeColorBtn.classList.add("selected");
        }
      }
    }
  }

  // Paleta de 10 Cores
  if (paletteContainer) {
    paletteContainer.innerHTML = "";
    const colors = [
      "#0f172a", // 1. Preto (Neutro escuro)
      "#ffffff", // 2. Branco (Neutro claro)
      "#78350f", // 3. Marrom (Terroso)
      "#ffd6d6", // 4. Pele / Rosa claro (Transição suave para os quentes)
      "#ef4444", // 5. Vermelho (Quente)
      "#f59e0b", // 6. Laranja / Amarelo (Quente)
      "#22c55e", // 7. Verde (Transição / Círculo cromático)
      "#3b82f6", // 8. Azul (Frio)
      "#a855f7", // 9. Roxo (Frio / Violáceo)
      "#ec4899", // 10. Rosa Pink (Fecha o ciclo voltando ao vermelho)
    ];

    colors.forEach((color, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.color = color;
      btn.className = "color-btn" + (index === 0 ? " selected" : "");
      btn.style.backgroundColor = color;

      btn.addEventListener("click", () => {
        closeSizePopup();
        currentColor = color;
        if (activeTool === "eraser") {
          setActiveTool("brush");
        }
        paletteContainer
          .querySelectorAll(".color-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });

      paletteContainer.appendChild(btn);
    });
  }

  // Botões de Ferramentas + Seletor de Espessura Vertical
  if (toolContainer) {
    toolContainer.innerHTML = "";

    const brushBtn = document.createElement("button");
    brushBtn.type = "button";
    brushBtn.className = "brush-btn active";
    brushBtn.textContent = "✏️ Pincel";

    const bucketBtn = document.createElement("button");
    bucketBtn.type = "button";
    bucketBtn.className = "bucket-btn";
    bucketBtn.textContent = "🪣 Balde";

    const eraserBtn = document.createElement("button");
    eraserBtn.type = "button";
    eraserBtn.className = "eraser-btn";
    eraserBtn.textContent = "🧹 Borracha";

    // Container do botão de espessura + Pop-up vertical
    const sizeWrapper = document.createElement("div");
    sizeWrapper.className = "size-wrapper";

    const sizeBtn = document.createElement("button");
    sizeBtn.type = "button";
    sizeBtn.className = "size-btn";
    sizeBtn.setAttribute("aria-label", "Ajustar espessura do traço");

    const sizePreviewDot = document.createElement("span");
    sizePreviewDot.className = "size-preview-dot";
    sizeBtn.appendChild(sizePreviewDot);

    const sizePopup = document.createElement("div");
    sizePopup.className = "size-popup";

    // Trilha vertical com SVG afunilado (grosso em cima -> fino embaixo)
    const sliderTrack = document.createElement("div");
    sliderTrack.className = "size-slider-track";
    sliderTrack.innerHTML = `
      <svg class="size-wedge-svg" viewBox="0 0 28 120" preserveAspectRatio="none">
        <polygon points="3,6 25,6 15.2,114 12.8,114" fill="#94a3b8" />
        <circle cx="14" cy="6" r="11" fill="#94a3b8" />
        <circle cx="14" cy="114" r="1.2" fill="#94a3b8" />
      </svg>
    `;

    const sliderThumb = document.createElement("div");
    sliderThumb.className = "size-slider-thumb";
    sliderTrack.appendChild(sliderThumb);
    sizePopup.appendChild(sliderTrack);

    sizeWrapper.appendChild(sizeBtn);
    sizeWrapper.appendChild(sizePopup);

    // Atualiza a posição da bolinha e o tamanho do ícone no botão
    function updateSizeUI() {
      const ratio = (currentLineWidth - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
      // Topo (5%) = Grosso (ratio 1) | Base (95%) = Fino (ratio 0) -> crava nas pontas do SVG (6/120 e 114/120)
      const topPercent = 5 + (1 - ratio) * 90;
      sliderThumb.style.top = `${topPercent}%`;

      // Bolinha interna do botão principal (escala visual de 3px a 18px)
      const visualDot = Math.max(
        3,
        Math.min(18, Math.round(currentLineWidth * 0.7)),
      );
      sizePreviewDot.style.width = `${visualDot}px`;
      sizePreviewDot.style.height = `${visualDot}px`;

      // Bolinha que corre na trilha também acompanha sutilmente a grossura
      const thumbSize = Math.round(14 + ratio * 8);
      sliderThumb.style.width = `${thumbSize}px`;
      sliderThumb.style.height = `${thumbSize}px`;
    }

    function setSizeFromPointer(clientY) {
      const rect = sliderTrack.getBoundingClientRect();
      const pad = rect.height * 0.05; // 5% de margem superior e inferior igual ao SVG
      const trackHeight = rect.height - pad * 2;
      const relY = Math.max(
        0,
        Math.min(trackHeight, clientY - (rect.top + pad)),
      );
      const ratio = 1 - relY / trackHeight; // Invertido: topo = 1, base = 0
      currentLineWidth =
        Math.round((MIN_SIZE + ratio * (MAX_SIZE - MIN_SIZE)) * 2) / 2;
      updateSizeUI();
    }

    let draggingSize = false;

    sliderTrack.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      draggingSize = true;
      sliderTrack.setPointerCapture(e.pointerId);
      setSizeFromPointer(e.clientY);
    });

    sliderTrack.addEventListener("pointermove", (e) => {
      if (!draggingSize) return;
      e.preventDefault();
      setSizeFromPointer(e.clientY);
    });

    const endDrag = () => {
      draggingSize = false;
    };
    sliderTrack.addEventListener("pointerup", endDrag);
    sliderTrack.addEventListener("pointercancel", endDrag);

    sizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = sizePopup.classList.toggle("open");
      sizeBtn.classList.toggle("active", isOpen);
    });

    brushBtn.addEventListener("click", () => {
      closeSizePopup();
      setActiveTool("brush");
    });
    bucketBtn.addEventListener("click", () => {
      closeSizePopup();
      setActiveTool("bucket");
    });
    eraserBtn.addEventListener("click", () => {
      closeSizePopup();
      setActiveTool("eraser");
    });

    updateSizeUI();

    toolContainer.appendChild(brushBtn);
    toolContainer.appendChild(bucketBtn);
    toolContainer.appendChild(eraserBtn);
    toolContainer.appendChild(sizeWrapper);
  }
}