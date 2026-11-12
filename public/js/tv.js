const socket = io();
import { sound } from "./modules/soundEngine.js?v=1";
function setTvConnectionBanner(text) {
  let banner = document.getElementById("tv-conn-banner");

  if (!text) {
    if (banner) banner.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "tv-conn-banner";
    banner.setAttribute("role", "status");
    banner.style.position = "fixed";
    banner.style.bottom = "0";
    banner.style.left = "0";
    banner.style.right = "0";
    banner.style.padding = "10px 16px";
    banner.style.textAlign = "center";
    banner.style.fontSize = "1.3rem";
    banner.style.fontWeight = "bold";
    banner.style.background = "#b45309";
    banner.style.color = "#ffffff";
    banner.style.zIndex = "100000";
    document.body.appendChild(banner);
  }

  banner.textContent = text;
}

socket.on("connect", () => {
  setTvConnectionBanner(null);
  socket.emit("tv-sync");
});

socket.on("disconnect", () => {
  setTvConnectionBanner("⚠️ Sem conexão com o servidor. Reconectando…");
});

// Ao voltar para a aba (ou quando a internet volta): reconecta na hora se estiver
// desconectada; se parecer conectada, pede o estado de novo por segurança.
function resyncTvNow() {
  if (socket.connected) {
    socket.emit("tv-sync");
  } else {
    socket.connect();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resyncTvNow();
});
window.addEventListener("online", resyncTvNow);

const controlUrl = window.location.origin + "/controle.html";
let isGameStarted = false;
let isPodium = false;

// QR CODE DA SALA
document.getElementById("room-url").innerText = controlUrl;
try {
  new QRCode(document.getElementById("qrcode"), {
    text: controlUrl,
    width: 150,
    height: 150,
  });
} catch (e) {
  console.warn("QR Code indisponível:", e);
}

const seatsGrid = document.getElementById("seats-grid");

// GERENCIADOR CENTRAL DE TELAS DA TV
function exibirTelaTV(idTelaDesejada) {
  const telas = ["lobby-screen", "game-screen", "presentation-screen"];
  telas.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const telaAtiva = document.getElementById(idTelaDesejada);
  if (telaAtiva) {
    telaAtiva.style.display = "block";
  }
}

// RENDERIZAÇÃO DOS LUGARES / ASSENTOS NO LOBBY
function renderSeats(players) {
  // Quem está ausente (a conexão caiu) não ocupa lugar; volta sozinho se reconectar.
  players = players.filter((p) => !p.disconnected);
  seatsGrid.innerHTML = "";
  document.getElementById("player-count").innerText = players.length;

  if (players.length > 0) {
    document.getElementById("tv-status").innerText =
      `Aguardando ${players[0].name} (Anfitrião) iniciar a partida...`;
  } else {
    document.getElementById("tv-status").innerText =
      "Aponte a câmera do celular para o QR Code para entrar na sala";
  }

  for (let i = 0; i < 8; i++) {
    const seatDiv = document.createElement("div");
    seatDiv.className = "seat";
    if (players[i]) {
      seatDiv.classList.add("occupied");

      const avatarDiv = document.createElement("div");
      avatarDiv.className = "avatar";
      avatarDiv.textContent = players[i].avatar;

      const nameDiv = document.createElement("div");
      nameDiv.className = "name";
      nameDiv.textContent = players[i].name;

      seatDiv.appendChild(avatarDiv);
      seatDiv.appendChild(nameDiv);
    } else {
      const seatSpan = document.createElement("span");
      seatSpan.textContent = `Lugar ${i + 1}`;

      const smallTag = document.createElement("small");
      smallTag.style.marginTop = "4px";
      smallTag.textContent = "Vazio";

      seatDiv.appendChild(seatSpan);
      seatDiv.appendChild(smallTag);
    }
    seatsGrid.appendChild(seatDiv);
  }
}

renderSeats([]);

// ATUALIZAÇÃO DO LOBBY
socket.on("update-lobby", (players) => {
  sound.playMusic("lobby");
  renderSeats(players);

  if (!isGameStarted) {
    exibirTelaTV("lobby-screen");
  }
});

// FASE DE DESENHO
socket.on("start-round", (data) => {
  sound.playMusic("drawing");
  isPodium = false;
  isGameStarted = true;
  exibirTelaTV("game-screen");

  document.getElementById("round-number").innerText = data.round;
  document.getElementById("theme-display").innerText = data.theme;

  // Reseta mensagem de progresso de envio
  const progressEl = document.getElementById("drawing-progress-display");
  if (progressEl) {
    progressEl.innerText = "Aguardando desenhos...";
  }
});

// PROGRESSO DE ENVIO DOS DESENHOS
socket.on("drawing-progress", (data) => {
  let progressEl = document.getElementById("drawing-progress-display");
  if (!progressEl) {
    progressEl = document.createElement("div");
    progressEl.id = "drawing-progress-display";
    progressEl.style.marginTop = "15px";
    progressEl.style.fontSize = "1.3rem";
    progressEl.style.color = "#38bdf8";
    progressEl.style.fontWeight = "bold";

    const gameScreen = document.getElementById("game-screen");
    if (gameScreen) gameScreen.appendChild(progressEl);
  }
  progressEl.innerText = `🎨 ${data.submitted} de ${data.total} desenhos recebidos`;
});

// TEMPORIZADOR VISUAL DA TV
socket.on("timer-tick", (timeLeft) => {
  if (timeLeft <= 5 && timeLeft > 0 && !isPodium) {
    sound.sfxTick();
  }
  if (isPodium) {
    const container = document.getElementById("presentation-container");
    if (!container) return;

    let msg = document.getElementById("podium-return-msg");
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "podium-return-msg";
      msg.style.marginTop = "25px";
      msg.style.fontSize = "1.4rem";
      msg.style.color = "#94a3b8";
      container.appendChild(msg);
    }
    msg.textContent = "Voltando ao lobby em " + Math.max(timeLeft, 0) + "s";
    return;
  }
  let tvTimer = document.getElementById("tv-timer-display");

  if (!tvTimer) {
    tvTimer = document.createElement("div");
    tvTimer.id = "tv-timer-display";
    tvTimer.style.position = "fixed";
    tvTimer.style.top = "20px";
    tvTimer.style.right = "30px";
    tvTimer.style.fontSize = "2rem";
    tvTimer.style.fontWeight = "bold";
    tvTimer.style.color = "#facc15";
    tvTimer.style.background = "#1e293b";
    tvTimer.style.padding = "10px 22px";
    tvTimer.style.borderRadius = "16px";
    tvTimer.style.border = "2px solid #38bdf8";
    tvTimer.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.4)";
    tvTimer.style.zIndex = "99999";
    document.body.appendChild(tvTimer);
  }

  tvTimer.style.display = "block";
  tvTimer.textContent = "⏱️ " + timeLeft + "s";

  if (timeLeft <= 10) {
    tvTimer.style.color = "#ef4444";
    tvTimer.style.borderColor = "#ef4444";
  } else {
    tvTimer.style.color = "#facc15";
    tvTimer.style.borderColor = "#38bdf8";
  }
});

// FASE DE VOTAÇÃO (APRESENTAÇÃO DOS DESENHOS)
socket.on("start-voting-round", (data) => {
  sound.playMusic("voting");
  isPodium = false;
  isGameStarted = true;
  exibirTelaTV("presentation-screen");

  const container = document.getElementById("presentation-container");
  container.innerHTML = "";

  const headerDiv = document.createElement("div");
  headerDiv.style.marginBottom = "25px";

  const roundP = document.createElement("p");
  roundP.style.color = "#94a3b8";
  roundP.style.fontSize = "1.2rem";
  roundP.style.margin = "0";
  roundP.textContent = `Rodada ${data.round} de 6 • Votação`;

  const themeH1 = document.createElement("h1");
  themeH1.style.color = "#facc15";
  themeH1.style.fontSize = "2.2rem";
  themeH1.style.margin = "5px 0 15px 0";
  themeH1.textContent = data.theme;

  const instructionP = document.createElement("p");
  instructionP.style.color = "#38bdf8";
  instructionP.style.fontSize = "1.1rem";
  instructionP.style.margin = "0";
  instructionP.textContent =
    "Vote no celular na ordem dos seus desenhos favoritos!";

  headerDiv.appendChild(roundP);
  headerDiv.appendChild(themeH1);
  headerDiv.appendChild(instructionP);

  const gridDiv = document.createElement("div");
  gridDiv.style.display = "flex";
  gridDiv.style.flexWrap = "wrap";
  gridDiv.style.gap = "20px";
  gridDiv.style.justifyContent = "center";
  gridDiv.style.width = "100%";
  gridDiv.style.maxWidth = "1100px";
  gridDiv.style.margin = "0 auto";

  data.cards.forEach((card) => {
    const cardDiv = document.createElement("div");
    cardDiv.style.background = "#1e293b";
    cardDiv.style.padding = "15px";
    cardDiv.style.borderRadius = "16px";
    cardDiv.style.border = `3px solid ${card.color}`;
    cardDiv.style.display = "flex";
    cardDiv.style.flexDirection = "column";
    cardDiv.style.alignItems = "center";
    cardDiv.style.boxShadow = "0 8px 20px rgba(0,0,0,0.4)";
    cardDiv.style.width = "220px";

    const numCircle = document.createElement("div");
    numCircle.style.background = card.color;
    numCircle.style.color = "#ffffff";
    numCircle.style.fontSize = "1.8rem";
    numCircle.style.fontWeight = "bold";
    numCircle.style.width = "50px";
    numCircle.style.height = "50px";
    numCircle.style.borderRadius = "50%";
    numCircle.style.display = "flex";
    numCircle.style.alignItems = "center";
    numCircle.style.justifyContent = "center";
    numCircle.style.marginBottom = "12px";
    numCircle.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    numCircle.textContent = card.number;

    const img = document.createElement("img");
    img.src = card.imageData;
    img.alt = `Desenho ${card.number}`;
    img.style.background = "white";
    img.style.borderRadius = "10px";
    img.style.width = "100%";
    img.style.height = "240px";
    img.style.objectFit = "contain";

    cardDiv.appendChild(numCircle);
    cardDiv.appendChild(img);
    gridDiv.appendChild(cardDiv);
  });

  container.appendChild(headerDiv);
  container.appendChild(gridDiv);
});

// FASE DE REVELAÇÃO (QUEM FEZ O QUÊ + QUEM VOTOU EM QUEM)
socket.on("reveal-voting-round", (data) => {
  const hasMasterpiece = data.cards && data.cards.some((c) => c.isMasterpiece);
  sound.sfxReveal(hasMasterpiece);
  isPodium = false;
  isGameStarted = true;
  exibirTelaTV("presentation-screen");

  const container = document.getElementById("presentation-container");
  container.innerHTML = "";

  const headerDiv = document.createElement("div");
  headerDiv.style.marginBottom = "25px";

  const roundP = document.createElement("p");
  roundP.style.color = "#facc15";
  roundP.style.fontSize = "1.3rem";
  roundP.style.fontWeight = "bold";
  roundP.style.margin = "0";
  roundP.textContent = `✨ Resultado da Rodada ${data.round} ✨`;

  const themeH1 = document.createElement("h1");
  themeH1.style.color = "#38bdf8";
  themeH1.style.fontSize = "2.2rem";
  themeH1.style.margin = "5px 0 10px 0";
  themeH1.textContent = data.theme;

  headerDiv.appendChild(roundP);
  headerDiv.appendChild(themeH1);

  const gridDiv = document.createElement("div");
  gridDiv.style.display = "flex";
  gridDiv.style.flexWrap = "wrap";
  gridDiv.style.gap = "20px";
  gridDiv.style.justifyContent = "center";
  gridDiv.style.width = "100%";
  gridDiv.style.maxWidth = "1100px";
  gridDiv.style.margin = "0 auto";

  data.cards.forEach((card) => {
    const cardDiv = document.createElement("div");
    cardDiv.style.position = "relative";
    cardDiv.style.background = card.isMasterpiece
      ? "linear-gradient(180deg, #422006 0%, #1e293b 100%)"
      : "#1e293b";
    cardDiv.style.padding = "18px 15px 15px 15px";
    cardDiv.style.borderRadius = "16px";
    cardDiv.style.border = card.isMasterpiece
      ? "3px solid #facc15"
      : `3px solid ${card.color}`;
    cardDiv.style.display = "flex";
    cardDiv.style.flexDirection = "column";
    cardDiv.style.alignItems = "center";
    cardDiv.style.boxShadow = card.isMasterpiece
      ? "0 0 28px rgba(250, 204, 21, 0.55)"
      : "0 8px 20px rgba(0,0,0,0.4)";
    cardDiv.style.width = "230px";

    // Se recebeu apenas e todas as medalhas de ouro, exibe o selo no topo
    if (card.isMasterpiece) {
      const masterpieceBadge = document.createElement("div");
      masterpieceBadge.style.position = "absolute";
      masterpieceBadge.style.top = "-14px";
      masterpieceBadge.style.background =
        "linear-gradient(90deg, #f59e0b, #facc15)";
      masterpieceBadge.style.color = "#0f172a";
      masterpieceBadge.style.fontWeight = "800";
      masterpieceBadge.style.fontSize = "0.82rem";
      masterpieceBadge.style.padding = "4px 12px";
      masterpieceBadge.style.borderRadius = "20px";
      masterpieceBadge.style.boxShadow = "0 4px 10px rgba(0,0,0,0.4)";
      masterpieceBadge.style.textTransform = "uppercase";
      masterpieceBadge.style.letterSpacing = "0.5px";
      masterpieceBadge.textContent = "👑 Obra de arte!";
      cardDiv.appendChild(masterpieceBadge);
    }
    // Cabeçalho com Artista e Pontos Ganhos
    const artistHeader = document.createElement("div");
    artistHeader.style.display = "flex";
    artistHeader.style.alignItems = "center";
    artistHeader.style.justifyContent = "space-between";
    artistHeader.style.width = "100%";
    artistHeader.style.marginBottom = "10px";

    const artistInfo = document.createElement("div");
    artistInfo.style.fontWeight = "bold";
    artistInfo.style.fontSize = "1.05rem";
    artistInfo.style.color = "#ffffff";
    artistInfo.style.overflow = "hidden";
    artistInfo.style.textOverflow = "ellipsis";
    artistInfo.style.whiteSpace = "nowrap";
    artistInfo.textContent = `${card.artistAvatar} ${card.artistName}`;

    const pointsBadge = document.createElement("span");
    pointsBadge.style.background = card.roundPoints > 0 ? "#22c55e" : "#475569";
    pointsBadge.style.color = "#ffffff";
    pointsBadge.style.fontWeight = "bold";
    pointsBadge.style.fontSize = "0.9rem";
    pointsBadge.style.padding = "3px 8px";
    pointsBadge.style.borderRadius = "12px";
    pointsBadge.textContent = `+${card.roundPoints} pts`;

    artistHeader.appendChild(artistInfo);
    artistHeader.appendChild(pointsBadge);

    // Wrapper da imagem com os emojis de quem votou por cima
    const imgWrapper = document.createElement("div");
    imgWrapper.style.position = "relative";
    imgWrapper.style.width = "100%";
    imgWrapper.style.height = "240px";

    const img = document.createElement("img");
    img.src = card.imageData;
    img.alt = `Desenho de ${card.artistName}`;
    img.style.background = "white";
    img.style.borderRadius = "10px";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";

    // Container flutuante em cima do desenho (na parte inferior da imagem)
    const votersOverlay = document.createElement("div");
    votersOverlay.style.position = "absolute";
    votersOverlay.style.bottom = "8px";
    votersOverlay.style.left = "8px";
    votersOverlay.style.right = "8px";
    votersOverlay.style.display = "flex";
    votersOverlay.style.flexWrap = "wrap";
    votersOverlay.style.gap = "6px";
    votersOverlay.style.justifyContent = "center";

    card.voters.forEach((v) => {
      const voterPill = document.createElement("span");
      voterPill.style.background = "rgba(15, 23, 42, 0.88)";
      voterPill.style.border = "1px solid #38bdf8";
      voterPill.style.borderRadius = "20px";
      voterPill.style.padding = "3px 8px";
      voterPill.style.fontSize = "1rem";
      voterPill.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
      voterPill.title = `${v.name} (${v.points} pts)`;
      voterPill.textContent = `${v.avatar}${v.medal}`;
      votersOverlay.appendChild(voterPill);
    });

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(votersOverlay);

    cardDiv.appendChild(artistHeader);
    cardDiv.appendChild(imgWrapper);
    gridDiv.appendChild(cardDiv);
  });

  container.appendChild(headerDiv);
  container.appendChild(gridDiv);
});

// FIM DE JOGO (PÓDIO FINAL)
socket.on("game-over", (leaderboard) => {
  sound.playMusic("podium");
  isGameStarted = true;
  isPodium = true;

  const tvTimer = document.getElementById("tv-timer-display");
  if (tvTimer) tvTimer.style.display = "none";

  exibirTelaTV("presentation-screen");

  const container = document.getElementById("presentation-container");
  container.innerHTML = "";

  const titleH1 = document.createElement("h1");
  titleH1.style.color = "#facc15";
  titleH1.style.fontSize = "3rem";
  titleH1.style.marginBottom = "20px";
  titleH1.textContent = "🏆 Pódio Final 🏆";

  const podiumWrapper = document.createElement("div");
  podiumWrapper.className = "podium-container";

  // Posição "densa": empatados dividem a posição e a seguinte não pula número.
  const ranked = [];
  let position = 0;
  let lastScore = null;
  leaderboard.forEach((p) => {
    if (p.score !== lastScore) {
      position++;
      lastScore = p.score;
    }
    ranked.push({ player: p, position });
  });

  const types = { 1: "gold", 2: "silver", 3: "bronze" };
  const podiumPlayers = ranked.filter((r) => r.position <= 3);
  const restPlayers = ranked.filter((r) => r.position > 3);

  // Ordem visual: pratas, depois ouros, depois bronzes (ouro fica no meio).
  [2, 1, 3].forEach((pos) => {
    podiumPlayers
      .filter((r) => r.position === pos)
      .forEach((r) =>
        podiumWrapper.appendChild(createPillar(r.player, pos, types[pos])),
      );
  });

  container.appendChild(titleH1);
  container.appendChild(podiumWrapper);

  if (restPlayers.length > 0) {
    const restList = document.createElement("div");
    restList.className = "rest-leaderboard";
    restPlayers.forEach((r) => {
      const row = document.createElement("div");
      row.className = "rest-row";
      row.textContent = `${r.position}º ${r.player.avatar} ${r.player.name} - ${r.player.score} pts`;
      restList.appendChild(row);
    });
    container.appendChild(restList);
  }
});

function createPillar(player, rank, type) {
  const pillar = document.createElement("div");
  pillar.className = `podium-pillar ${type}`;

  const avatar = document.createElement("div");
  avatar.className = "podium-avatar";
  avatar.textContent = player.avatar;

  const badge = document.createElement("div");
  badge.className = "podium-rank-badge";
  badge.textContent = rank;

  const name = document.createElement("div");
  name.className = "podium-name";
  name.textContent = player.name;

  const score = document.createElement("div");
  score.className = "podium-score";
  score.textContent = `${player.score} pts`;

  pillar.appendChild(avatar);
  pillar.appendChild(badge);
  pillar.appendChild(name);
  pillar.appendChild(score);
  return pillar;
}

// RETORNO AO LOBBY
socket.on("back-to-lobby", (players) => {
  sound.playMusic("lobby");
  isPodium = false;
  isGameStarted = false;

  const tvTimer = document.getElementById("tv-timer-display");
  if (tvTimer) tvTimer.style.display = "none";

  exibirTelaTV("lobby-screen");
  renderSeats(players);
});
