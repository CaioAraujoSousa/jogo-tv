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
 *   node test/bots.js 4 --drop         -> um bot "troca de app" na rodada 2
 *   node test/bots.js 4 --url=https://jogo-tv.onrender.com   (site na Render)
 *
 * Importante: isto testa a comunicação (eventos Socket.IO). Não abre navegador,
 * então NÃO testa se o tv.js desenha a tela corretamente.
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
const DROP = args.includes("--drop");
// Segundos que cada bot espera antes de enviar desenho/voto (máx. 25, por causa do timer de 30 s da votação).
const DELAY_S = Math.min(parseFloat(getOpt("delay", "0")) || 0, 25);
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
    joined: false, startedGame: false,
    dropped: false, reconnected: false, recognized: null,
    everConnected: false,
  };
  clients.push(c);

  // Depois de reconectar, o cliente real (controle.js) ignora os eventos do jogo
  // quando não se reconhece na lista. O bot imita esse comportamento.
  const ignoring = () => c.reconnected && !c.recognized;

  const record = (eventName) => {
    c.seq.push(eventName);
    if (!isBot) console.log(`[${elapsed()}] TV recebeu: ${eventName}`);
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
      console.log(`[${elapsed()}] ${label} voltou com NOVO id: ${socket.id}`);
    }
  });

  socket.on("error-message", (msg) => fail(`${label} recebeu erro do servidor: "${msg}"`));

  socket.on("update-lobby", (players) => {
    c.players = players;

    if (c.reconnected) {
      c.recognized = players.some((p) => p.id === socket.id);
    }

  });

  socket.on("start-round", (data) => {
    record(`start-round ${data.round}`);
    if (!isBot || ignoring()) return;

    if (DROP && c.isDropTarget && data.round === 2 && !c.dropped) {
      c.dropped = true;
      console.log(`[${elapsed()}] ${label} PERDEU A CONEXÃO (simulando troca de app) na rodada 2`);
      socket.disconnect();
      setTimeout(() => socket.connect(), 1500);
      return;
    }

    setTimeout(() => {
      socket.emit(
        "submit-drawing",
        { round: data.round, imageData: fakeImage(label, data.round) },
        (res) => {
          if (!res || !res.ok) {
            fail(`${label}: desenho da rodada ${data.round} recusado (${res && res.message})`);
          }
        },
      );
    }, randomDelay());
  });

  socket.on("start-voting-round", (data) => {
    record(`start-voting-round ${data.round}`);

    if (!isBot) {
      // A TV confere se recebeu todos os desenhos, com imagem.
      const expectedCards = DROP && data.round !== 1 ? NUM_BOTS - 1 : NUM_BOTS;
      const withImage = data.cards.filter(
        (card) => typeof card.imageData === "string" && card.imageData.startsWith("data:image"),
      ).length;
      const bytes = data.cards.reduce((sum, card) => sum + card.imageData.length, 0);
      console.log(
        `           votação ${data.round}: ${data.cards.length} desenhos, ` +
          `${withImage} com imagem, ~${(bytes / 1024).toFixed(0)} KB`,
      );
      if (data.cards.length !== expectedCards || withImage !== data.cards.length) {
        fail(`TV recebeu votação ${data.round} incompleta (${withImage}/${expectedCards} desenhos com imagem)`);
      }
      return;
    }

    if (ignoring()) return;

    const others = data.cards.filter((card) => card.artistId !== socket.id);
    const picks = shuffle(others.map((card) => card.number)).slice(0, Math.min(3, others.length));

    setTimeout(() => {
      socket.emit("submit-votes", { round: data.round, votes: picks }, (res) => {
        if (!res || !res.ok) {
          fail(`${label}: votos da rodada ${data.round} recusados (${res && res.message})`);
        }
      });
    }, randomDelay());
  });

  socket.on("game-over", (leaderboard) => {
    record("game-over");
    c.leaderboard = leaderboard;
    if (!isBot || ignoring()) return;

    // O anfitrião volta ao lobby, o que também deixa o servidor limpo para o próximo teste.
    const active = c.players.filter((p) => !p.disconnected);
    if (active.length > 0 && active[0].id === socket.id) {
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
  for (const c of clients) {
    if (DROP && c.dropped) continue; // o bot que caiu é analisado à parte
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

    if (!DROP) {
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
    console.log("\n3) Cenário de queda (--drop)");
    console.log(`   ${dropper.label} perdeu a conexão na rodada 2 e reconectou.`);
    console.log(
      `   O servidor reconheceu ${dropper.label} como o mesmo jogador? ` +
        (dropper.recognized ? "SIM" : "NÃO (jogador zumbi, BUG-04)"),
    );
    console.log("   Esperado hoje: NÃO. Depois da Etapa 1B (reentrada): SIM.");
  }

  const zombie = DROP && clients.some((c) => c.dropped && !c.recognized);
  if (failures.length > 0) {
    console.log(`\n❌ ${failures.length} PROBLEMA(S) ENCONTRADO(S)`);
  } else if (zombie) {
    console.log("\n⚠️  Partida concluída, mas o jogador que caiu NÃO voltou ao jogo (veja a seção 3).");
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
  process.exit(1);
}, TIMEOUT_MS);

// ---------- Início ----------
console.log(
  `Iniciando teste: ${NUM_BOTS} bots, desenhos de ~${IMAGE_KB} KB, ${SERVER_URL}${DROP ? ", com queda na rodada 2" : ""}\n`,
);
createClient("TV", null);

// Quando a TV já está conectada e todos os bots entraram, quem iniciou a partida é o anfitrião:
// o PRIMEIRO da lista. Pela internet a ordem de chegada varia, então nem sempre é o Bot1.
let startRequested = false;
const starter = setInterval(() => {
  const tvClient = clients.find((x) => !x.isBot);
  if (!tvClient || !tvClient.everConnected) return;
  const active = tvClient.players.filter((p) => !p.disconnected);
  if (active.length !== NUM_BOTS) return;
  const host = clients.find((x) => x.isBot && x.socket.connected && x.socket.id === active[0].id);
  if (!host) return;

  clearInterval(starter);
  startRequested = true;
  if (DROP) {
    // No cenário de queda, quem cai é um bot que NÃO é o anfitrião.
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