/*
 * JOGADORES ROBÔS + "TV" OBSERVADORA
 *
 * Joga uma partida completa sozinho (6 rodadas de desenho, 6 votações)
 * e confere se todos os clientes receberam os eventos certos, na ordem certa.
 *
 * Uso (com o servidor já rodando em outro terminal):
 *   node test/bots.js                  -> 4 bots, servidor em localhost:3000
 *   node test/bots.js 8                -> 8 bots
 *   node test/bots.js 4 --kb=200       -> desenhos de ~200 KB (teste de peso)
 *   node test/bots.js 4 --delay=8      -> bots lentos (8 s por ação), para assistir na TV
 *   node test/bots.js 4 --url=https://jogo-tv.onrender.com   (site na Render)
 *
 * Cenários de queda (um bot perde a conexão, volta com outro id de conexão e
 * precisa ser reconhecido como o MESMO jogador):
 *   node test/bots.js 4 --drop-lobby   -> cai no lobby, logo depois de entrar
 *   node test/bots.js 4 --drop         -> cai no começo da rodada de desenho 2
 *   node test/bots.js 4 --drop-voting  -> cai no começo da votação 2
 *
 * Atenção: no lobby, quem sai fica "ausente" por 30 s no servidor antes de ser
 * removido. Entre duas execuções seguidas, espere cerca de 30 s (ou reinicie o servidor).
 *
 * Importante: isto testa a comunicação (eventos Socket.IO). Não abre navegador,
 * então NÃO testa se o tv.js / controle.js desenham a tela corretamente.
 */
const { io } = require("socket.io-client");

// ---------- Opções ----------
const args = process.argv.slice(2);
const getOpt = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : fallback;
};
const NUM_BOTS = parseInt(args.find((a) => /^\d+$/.test(a)) || "4", 10);
const SERVER_URL = getOpt("url", "http://localhost:3000");
const IMAGE_KB = parseInt(getOpt("kb", "40"), 10);
const DROP_MODE = args.includes("--drop")
  ? "drawing"
  : args.includes("--drop-voting")
    ? "voting"
    : args.includes("--drop-lobby")
      ? "lobby"
      : null;
const DROP = DROP_MODE !== null;
// Segundos que cada bot espera antes de enviar desenho/voto (máx. 25, por causa do timer de 30 s da votação).
// Nos cenários de queda o padrão é 1 s, para dar tempo de o bot voltar antes do fim da partida.
const DELAY_S = Math.min(parseFloat(getOpt("delay", DROP ? "1" : "0")) || 0, 25);
const TIMEOUT_MS = 120_000;

if (NUM_BOTS < 2 || NUM_BOTS > 8) {
  console.error("Use entre 2 e 8 bots.");
  process.exit(1);
}

// Evita o 🦄 de propósito (ver BUG-03). Repetir avatar não é problema.
const AVATARS = ["🦊", "🐼", "🐱", "🐶", "🦁", "🤖", "🚀", "🦊"];

// Ordem esperada dos eventos de jogo, do ponto de vista de qualquer cliente.
const EXPECTED = [
  "start-round 1", "start-round 2", "start-round 3",
  "start-voting-round 1", "start-voting-round 2", "start-voting-round 3",
  "start-round 4", "start-round 5", "start-round 6",
  "start-voting-round 4", "start-voting-round 5", "start-voting-round 6",
  "game-over",
  "back-to-lobby",
];

// ---------- Utilitários ----------
const t0 = Date.now();
const elapsed = () => String(Date.now() - t0).padStart(5) + "ms";
const clients = [];
const failures = [];
let finished = false;
let startRequested = false;

const ok = (msg) => console.log(`   ✅ ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`   ❌ ${msg}`);
};
const randomDelay = () => DELAY_S * 1000 + 100 + Math.random() * 300;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// O servidor só confere o prefixo "data:image/jpeg;base64," e o tamanho,
// então o conteúdo pode ser qualquer texto. (Não é uma imagem de verdade.)
function fakeImage(label, round) {
  const target = Math.floor((IMAGE_KB * 1024 * 3) / 4);
  const text = `${label}-rodada-${round}-`.padEnd(target, ".");
  return "data:image/jpeg;base64," + Buffer.from(text).toString("base64");
}

// ---------- Cliente (bot ou TV) ----------
function createClient(label, index) {
  const isBot = index !== null;
  const socket = io(SERVER_URL);
  const c = {
    label, index, isBot, socket,
    seq: [], players: [], leaderboard: null,
    joined: false,
    // Identidade do jogador: NÃO muda quando a conexão muda.
    playerId: null,
    originalPlayerId: null,
    token: null,
    sameIdentity: null,
    isDropTarget: DROP_MODE === "lobby" && index === NUM_BOTS - 1,
    dropped: false, reconnected: false, recognized: null,
    everConnected: false,
  };
  clients.push(c);

  const myId = () => c.playerId || socket.id;

  // Depois de reconectar, o bot só age quando o servidor o reconhece (evento "rejoined"),
  // como o celular de verdade. Antes disso, ignora os eventos do jogo.
  const ignoring = () => c.reconnected && c.recognized !== true;

  const record = (eventName) => {
    c.seq.push(eventName);
    if (!isBot) console.log(`[${elapsed()}] TV recebeu: ${eventName}`);
  };

  const dropConnection = (when) => {
    c.dropped = true;
    console.log(`[${elapsed()}] ${label} PERDEU A CONEXÃO (simulando troca de app) ${when}`);
    socket.disconnect();
    setTimeout(() => socket.connect(), 1500);
  };

  // "late" = ação disparada pelo retrato da reconexão; pode ser recusada se a fase já passou.
  const submitDrawingLater = (round, late) => {
    setTimeout(() => {
      socket.emit("submit-drawing", { round, imageData: fakeImage(label, round) }, (res) => {
        if (res && res.ok) return;
        if (late) {
          console.log(`           (${label}: desenho atrasado recusado, normal numa reconexão: ${res && res.message})`);
        } else {
          fail(`${label}: desenho da rodada ${round} recusado (${res && res.message})`);
        }
      });
    }, randomDelay());
  };

  const voteLater = (data, late) => {
    const others = data.cards.filter((card) => card.artistId !== myId());
    const picks = shuffle(others.map((card) => card.number)).slice(0, Math.min(3, others.length));
    setTimeout(() => {
      socket.emit("submit-votes", { round: data.round, votes: picks }, (res) => {
        if (res && res.ok) return;
        if (late) {
          console.log(`           (${label}: voto atrasado recusado, normal numa reconexão: ${res && res.message})`);
        } else {
          fail(`${label}: votos da rodada ${data.round} recusados (${res && res.message})`);
        }
      });
    }, randomDelay());
  };

  socket.on("connect_error", (err) => {
    if (!c.everConnected && !c.warnedConnect) {
      c.warnedConnect = true;
      console.log(
        `[${elapsed()}] ${label} ainda não conseguiu conectar em ${SERVER_URL} (${err.message}). ` +
          "Continuo tentando (o servidor gratuito da Render pode estar acordando)...",
      );
    }
  });

  socket.on("connect", () => {
    c.everConnected = true;
    c.transport = socket.io.engine.transport.name;
    socket.io.engine.on("upgrade", () => {
      c.transport = socket.io.engine.transport.name;
    });
    if (isBot && !c.joined) {
      c.joined = true;
      socket.emit("join-game", { name: label, avatar: AVATARS[index % AVATARS.length] });
    }
    if (c.dropped) {
      c.reconnected = true;
      console.log(`[${elapsed()}] ${label} voltou com NOVO id de conexão: ${socket.id}`);
      // O celular de verdade faz o mesmo: apresenta o token guardado.
      if (c.token) socket.emit("rejoin", { token: c.token });
    }
  });

  socket.on("error-message", (msg) => fail(`${label} recebeu erro do servidor: "${msg}"`));

  // O servidor entrega a identidade e o token secreto assim que o jogador entra.
  socket.on("joined", (info) => {
    c.playerId = info.playerId;
    c.originalPlayerId = info.playerId;
    c.token = info.token;
    if (c.isDropTarget && !c.dropped) dropConnection("no lobby, logo depois de entrar");
  });

  socket.on("rejoined", (snap) => {
    c.recognized = true;
    c.sameIdentity = snap.playerId === c.originalPlayerId;
    console.log(
      `[${elapsed()}] ${label} reconhecido pelo servidor ` +
        `${c.sameIdentity ? "como o MESMO jogador" : "mas com id DIFERENTE"} (fase: ${snap.phase})`,
    );
    if (snap.phase === "drawing" && !snap.hasSubmitted) submitDrawingLater(snap.drawing.round, true);
    if (snap.phase === "voting" && !snap.hasVoted) voteLater(snap.voting, true);
  });

  socket.on("rejoin-failed", () => {
    c.recognized = false;
    console.log(`[${elapsed()}] ${label} NÃO foi reconhecido (rejoin recusado pelo servidor)`);
  });

  socket.on("update-lobby", (players) => {
    c.players = players;
  });

  socket.on("start-round", (data) => {
    record(`start-round ${data.round}`);
    if (!isBot || ignoring()) return;

    if (DROP_MODE === "drawing" && c.isDropTarget && data.round === 2 && !c.dropped) {
      dropConnection("na rodada de desenho 2");
      return;
    }
    submitDrawingLater(data.round, false);
  });

  socket.on("start-voting-round", (data) => {
    record(`start-voting-round ${data.round}`);

    if (!isBot) {
      // A TV confere se recebeu todos os desenhos, com imagem.
      // Na queda durante o desenho, o bot que caiu pode ou não ter enviado o desenho da rodada 2.
      const expectedMin = DROP_MODE === "drawing" ? NUM_BOTS - 1 : NUM_BOTS;
      const withImage = data.cards.filter(
        (card) => typeof card.imageData === "string" && card.imageData.startsWith("data:image"),
      ).length;
      const bytes = data.cards.reduce((sum, card) => sum + card.imageData.length, 0);
      console.log(
        `           votação ${data.round}: ${data.cards.length} desenhos, ` +
          `${withImage} com imagem, ~${(bytes / 1024).toFixed(0)} KB`,
      );
      if (data.cards.length < expectedMin || data.cards.length > NUM_BOTS || withImage !== data.cards.length) {
        fail(`TV recebeu votação ${data.round} incompleta (${withImage}/${NUM_BOTS} desenhos com imagem)`);
      }
      return;
    }

    if (ignoring()) return;

    if (DROP_MODE === "voting" && c.isDropTarget && data.round === 2 && !c.dropped) {
      dropConnection("na votação 2");
      return;
    }
    voteLater(data, false);
  });

  socket.on("game-over", (leaderboard) => {
    record("game-over");
    c.leaderboard = leaderboard;
    if (!isBot || ignoring()) return;

    // O anfitrião volta ao lobby, o que também deixa o servidor limpo para o próximo teste.
    const active = c.players.filter((p) => !p.disconnected);
    if (active.length > 0 && active[0].id === myId()) {
      setTimeout(() => socket.emit("return-to-lobby"), 500);
    }
  });

  socket.on("back-to-lobby", () => {
    record("back-to-lobby");
    const tvSawGameOver = clients.find((x) => !x.isBot).seq.includes("game-over");
    if (!isBot && tvSawGameOver) setTimeout(finish, 500);
  });

  return c;
}

// ---------- Resultado ----------
function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(globalTimer);

  console.log("\n===== RESULTADO =====");

  console.log("\n0) Transporte de rede usado por cada cliente");
  for (const c of clients) console.log(`   ${c.label}: ${c.transport || "?"}`);
  if (clients.some((c) => c.transport === "polling")) {
    console.log('   ⚠️  Algum cliente ficou em "polling": a rede pode estar bloqueando WebSocket (mais frágil).');
  }

  console.log("\n1) Todos receberam os eventos na ordem certa?");
  const skipDropper = DROP_MODE === "drawing" || DROP_MODE === "voting";
  for (const c of clients) {
    if (skipDropper && c.dropped) continue; // o bot que caiu perdeu eventos enquanto estava fora
    if (JSON.stringify(c.seq) === JSON.stringify(EXPECTED)) {
      ok(`${c.label}: ${c.seq.length} eventos, ordem correta`);
    } else {
      const missing = EXPECTED.filter((e) => !c.seq.includes(e));
      fail(
        `${c.label}: sequência diferente. Faltando: [${missing.join(", ") || "nenhum"}]. ` +
          `Recebeu: [${c.seq.join(", ")}]`,
      );
    }
  }

  const tv = clients.find((c) => !c.isBot);
  console.log("\n2) Pódio");
  if (!tv.leaderboard) {
    fail("TV não recebeu o pódio (game-over)");
  } else {
    console.log("   " + tv.leaderboard.map((p) => `${p.name}: ${p.score}`).join(" | "));
    if (tv.leaderboard.length !== NUM_BOTS) {
      fail(`Pódio tem ${tv.leaderboard.length} jogadores, esperado ${NUM_BOTS}`);
    } else {
      ok(`Pódio com ${NUM_BOTS} jogadores`);
    }

    // Só confere a soma quando todos votaram em todas as rodadas.
    if (!DROP || DROP_MODE === "lobby") {
      // Cada votante distribui 50+30+20 (ou menos, se houver menos de 3 desenhos de outros).
      const perVoter = [50, 30, 20].slice(0, Math.min(3, NUM_BOTS - 1)).reduce((a, b) => a + b, 0);
      const expectedTotal = NUM_BOTS * 6 * perVoter;
      const total = tv.leaderboard.reduce((sum, p) => sum + p.score, 0);
      if (total === expectedTotal) ok(`Soma dos pontos = ${total} (esperado ${expectedTotal})`);
      else fail(`Soma dos pontos = ${total}, esperado ${expectedTotal}`);
    }
  }

  if (DROP) {
    const dropper = clients.find((c) => c.dropped);
    console.log(`\n3) Cenário de queda (--drop${DROP_MODE === "drawing" ? "" : "-" + DROP_MODE})`);
    if (!dropper) {
      fail("Nenhum bot chegou a perder a conexão (o cenário não aconteceu)");
    } else {
      console.log(`   ${dropper.label} perdeu a conexão (${DROP_MODE}) e reconectou com outro id de conexão.`);

      if (dropper.recognized === true) {
        ok(`${dropper.label} foi reconhecido pelo servidor ao voltar`);
        if (dropper.sameIdentity) ok("Mesma identidade de jogador antes e depois da queda");
        else fail("O servidor devolveu um id de jogador diferente do original");
      } else {
        fail(`${dropper.label} NÃO foi reconhecido ao voltar (servidor sem reentrada ou token recusado)`);
      }

      if (tv.leaderboard) {
        const ids = tv.leaderboard.map((p) => p.id);
        if (new Set(ids).size === ids.length) ok("Nenhum jogador duplicado no pódio");
        else fail("Há jogadores duplicados no pódio");
        if (dropper.originalPlayerId && ids.includes(dropper.originalPlayerId)) {
          ok(`${dropper.label} aparece no pódio com o id original`);
        } else {
          fail(`${dropper.label} não aparece no pódio com o id original`);
        }
      }
    }
  }

  if (failures.length > 0) {
    console.log(`\n❌ ${failures.length} PROBLEMA(S) ENCONTRADO(S)`);
  } else {
    console.log("\n✅ TUDO CERTO");
  }
  clients.forEach((c) => c.socket.close());
  process.exit(failures.length === 0 ? 0 : 1);
}

const globalTimer = setTimeout(() => {
  if (finished) return;
  console.log(`\n⏰ Tempo esgotado (${TIMEOUT_MS / 1000}s). Estado de cada cliente:`);
  for (const c of clients) {
    console.log(
      `   ${c.label}: transporte=${c.transport || "?"} | lobby=${c.players.length} jogadores | eventos=[${c.seq.join(", ")}]`,
    );
  }
  console.log(`   start-game foi enviado? ${startRequested ? "sim" : "não"}`);
  console.log("   Dicas: se nenhum cliente conectou, confira a URL. Se o servidor já tinha jogadores ou uma partida");
  console.log("   em andamento, reinicie-o (local: Ctrl+C e inicie de novo; Render: aguarde ~1 min sem jogadores).");
  console.log("   No lobby, jogadores que saíram ocupam a vaga por ~30 s: espere antes de repetir o teste.");
  process.exit(1);
}, TIMEOUT_MS);

// ---------- Início ----------
console.log(
  `Iniciando teste: ${NUM_BOTS} bots, desenhos de ~${IMAGE_KB} KB, ${SERVER_URL}` +
    `${DROP ? `, com queda (${DROP_MODE})` : ""}\n`,
);
createClient("TV", null);

// Quando a TV já está conectada e todos os bots entraram, quem entrou primeiro é o anfitrião:
// o PRIMEIRO da lista. Pela internet a ordem de chegada varia, então nem sempre é o Bot1.
const starter = setInterval(() => {
  const tvClient = clients.find((x) => !x.isBot);
  if (!tvClient || !tvClient.everConnected) return;
  const active = tvClient.players.filter((p) => !p.disconnected);
  if (active.length !== NUM_BOTS) return;
  const host = clients.find(
    (x) => x.isBot && x.socket.connected && (x.playerId || x.socket.id) === active[0].id,
  );
  if (!host) return;

  clearInterval(starter);
  startRequested = true;
  if (DROP_MODE === "drawing" || DROP_MODE === "voting") {
    // Nestes cenários, quem cai é um bot que NÃO é o anfitrião.
    const others = clients.filter((x) => x.isBot && x !== host);
    others[others.length - 1].isDropTarget = true;
  }
  console.log(`[${elapsed()}] ${host.label} entrou primeiro e é o anfitrião; vai iniciar a partida`);
  host.socket.emit("start-game");
}, 300);

for (let i = 0; i < NUM_BOTS; i++) {
  // Entradas escalonadas (a ordem real de chegada pode variar pela internet).
  setTimeout(() => createClient(`Bot${i + 1}`, i), 300 + i * 150);
}