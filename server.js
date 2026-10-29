const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const gameState = require("./src/gameState");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  pingTimeout: 5000,
  pingInterval: 10000,
});

app.use(express.static("public"));

app.post("/reset", (req, res) => {
  const expectedToken = process.env.RESET_TOKEN;
  const providedToken = req.get("x-reset-token");

  // Sem uma chave configurada, o reset fica indisponível.
  if (!expectedToken || providedToken !== expectedToken) {
    return res.status(404).send("Não encontrado.");
  }

  resetRoom();

  return res.send(
    "<h1>Sala resetada com sucesso. Todos podem entrar novamente.</h1>",
  );
});

// --- CONTROLE DE TEMPORIZADOR E TRAVAS DE ESTADO ---
let roundTimerInterval = null;
let roundTimeoutHandle = null;
let roundTimeLeft = 0;
let isTransitioning = false; // Trava para impedir avanços duplos de rodada

// --- TOLERÂNCIA A QUEDAS DE CONEXÃO ---
// Tempos em milissegundos. As variáveis de ambiente existem só para facilitar testes.
const LOBBY_GRACE_MS = Number(process.env.LOBBY_GRACE_MS) || 30_000;
const EMPTY_ROOM_MS = Number(process.env.EMPTY_ROOM_MS) || 30_000;

// id do jogador -> id da conexão (socket) que o representa agora.
const playerSockets = new Map();
// id do jogador -> timer de remoção (só vale no lobby).
const pendingRemovals = new Map();
let emptyRoomTimeout = null;

function cancelPendingRemoval(playerId) {
  const timeout = pendingRemovals.get(playerId);
  if (timeout) {
    clearTimeout(timeout);
    pendingRemovals.delete(playerId);
  }
}

function clearGraceTimers() {
  pendingRemovals.forEach((timeout) => clearTimeout(timeout));
  pendingRemovals.clear();
  if (emptyRoomTimeout) {
    clearTimeout(emptyRoomTimeout);
    emptyRoomTimeout = null;
  }
}

// Limpa a sala inteira (usado pelo /reset e quando a sala fica vazia).
function resetRoom() {
  clearRoundTimer();
  isTransitioning = false;
  clearGraceTimers();
  playerSockets.clear();

  gameState.reset();

  // Notifica todos os clientes para voltarem às telas iniciais.
  io.emit("back-to-lobby", []);
  io.emit("update-lobby", []);
}

// No lobby, quem some é marcado como ausente e só é removido se não voltar a tempo.
function scheduleLobbyRemoval(playerId) {
  cancelPendingRemoval(playerId);

  const timeout = setTimeout(() => {
    pendingRemovals.delete(playerId);

    const player = gameState.players.find((p) => p.id === playerId);
    if (!player || !player.disconnected || gameState.isStarted) return;

    gameState.removePlayer(playerId);
    io.emit("update-lobby", gameState.players);
    console.log(`Jogador ${player.name} removido do lobby (ausente por muito tempo).`);
  }, LOBBY_GRACE_MS);

  pendingRemovals.set(playerId, timeout);
}

// Durante a partida, se todos saírem, a sala só é limpa depois de um tempo.
function scheduleEmptyRoomReset() {
  if (emptyRoomTimeout) clearTimeout(emptyRoomTimeout);

  emptyRoomTimeout = setTimeout(() => {
    emptyRoomTimeout = null;
    if (!gameState.players.every((p) => p.disconnected)) return;

    console.log("Sala sem jogadores ativos por muito tempo. Sala limpa.");
    resetRoom();
  }, EMPTY_ROOM_MS);
}

function drawingProgressData() {
  const activePlayers = gameState.players.filter((p) => !p.disconnected);
  const roundDrawings = gameState.drawings[gameState.currentRound] || {};

  const submitted = activePlayers.filter((p) =>
    Object.prototype.hasOwnProperty.call(roundDrawings, p.id),
  ).length;

  return { submitted, total: activePlayers.length };
}

function emitDrawingProgress() {
  io.emit("drawing-progress", drawingProgressData());
}

// Retrato da partida enviado SÓ ao jogador que voltou (não altera o estado do jogo).
function buildSnapshot(playerId) {
  const snapshot = {
    playerId,
    phase: gameState.phase,
    isStarted: gameState.isStarted,
  };

  if (gameState.phase === "drawing") {
    snapshot.drawing = gameState.peekRoundData();
    snapshot.hasSubmitted = gameState.hasSubmittedDrawing(playerId);
  } else if (gameState.phase === "voting") {
    snapshot.voting = gameState.peekVotingData();
    snapshot.hasVoted = gameState.hasVoted(playerId);
  } else if (gameState.phase === "game-over") {
    snapshot.leaderboard = gameState.peekLeaderboard();
  }

  return snapshot;
}

function clearRoundTimer() {
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
    roundTimerInterval = null;
  }
  if (roundTimeoutHandle) {
    clearTimeout(roundTimeoutHandle);
    roundTimeoutHandle = null;
  }
}

function startRoundTimer(seconds, onTimeout) {
  clearRoundTimer();
  isTransitioning = false; // Libera nova rodada para processar envios
  roundTimeLeft = seconds;
  io.emit("timer-tick", roundTimeLeft);

  roundTimerInterval = setInterval(() => {
    roundTimeLeft--;
    io.emit("timer-tick", roundTimeLeft);

    if (roundTimeLeft <= 0) {
      clearRoundTimer();

      // Tolerância de 1.2s rastreada para poder ser cancelada se necessário
      roundTimeoutHandle = setTimeout(() => {
        onTimeout();
      }, 1200);
    }
  }, 1000);
}

io.on("connection", (socket) => {
  console.log(
    "Novo dispositivo conectado:",
    socket.id,
    "|",
    (socket.handshake.headers["user-agent"] || "").slice(0, 70),
  );

  socket.emit("update-lobby", gameState.players);

  socket.on("join-game", (data) => {
    // Só é permitido entrar durante o lobby.
    if (gameState.phase !== "lobby" || gameState.isStarted) {
      socket.emit(
        "error-message",
        "A partida já começou! Aguarde a próxima partida.",
      );
      return;
    }

    // Impede que o mesmo dispositivo seja registrado duas vezes.
    const existingPlayer = gameState.players.find(
      (player) => player.id === socket.data.playerId,
    );

    if (existingPlayer) {
      // Apenas sincroniza novamente esse jogador com o lobby.
      socket.emit("update-lobby", gameState.players);
      return;
    }

    // Valida os dados recebidos do cliente.
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      socket.emit("error-message", "Dados de entrada inválidos.");
      return;
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";

    if (!name) {
      socket.emit("error-message", "Digite um apelido válido.");
      return;
    }

    if (name.length > 12) {
      socket.emit(
        "error-message",
        "O apelido deve ter no máximo 12 caracteres.",
      );
      return;
    }

    // Aceita somente os avatares oferecidos pelo jogo.
    const allowedAvatars = new Set([
      "🦊",
      "🐼",
      "🐱",
      "🐶",
      "🦁",
      "🦄",
      "🤖",
      "🚀",
    ]);

    const avatar = allowedAvatars.has(data.avatar) ? data.avatar : "🦊";

    if (gameState.players.length >= 8) {
      socket.emit(
        "error-message",
        "A sala está cheia! (Máximo de 8 jogadores)",
      );
      return;
    }

    // Evita nomes repetidos, inclusive com diferenças de maiúsculas,
    // minúsculas ou espaços nas extremidades.
    const normalizedName = name.toLocaleLowerCase("pt-BR");

    const nameAlreadyUsed = gameState.players.some(
      (player) =>
        !player.disconnected &&
        typeof player.name === "string" &&
        player.name.trim().toLocaleLowerCase("pt-BR") === normalizedName,
    );

    if (nameAlreadyUsed) {
      socket.emit("error-message", "Este nome já está em uso. Escolha outro!");
      return;
    }

    gameState.addPlayer(socket.id, name, avatar);
    socket.data.playerId = socket.id;
    playerSockets.set(socket.id, socket.id);

    // Entrega ao celular a identidade (pública) e o token (secreto) para reentrar depois.
    socket.emit("joined", {
      playerId: socket.id,
      token: gameState.issueToken(socket.id),
    });

    io.emit("update-lobby", gameState.players);
  });

  // REENTRADA: o celular apresenta o token e volta a ser o mesmo jogador.
  socket.on("rejoin", (data) => {
    const token = data && typeof data === "object" ? data.token : null;
    const playerId = gameState.getPlayerIdByToken(token);
    const player = playerId
      ? gameState.players.find((p) => p.id === playerId)
      : null;

    if (!player) {
      socket.emit("rejoin-failed");
      return;
    }

    // Se ainda existir uma conexão antiga do mesmo jogador, esta nova a substitui.
    const oldSocketId = playerSockets.get(playerId);
    playerSockets.set(playerId, socket.id);
    socket.data.playerId = playerId;

    if (oldSocketId && oldSocketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) oldSocket.disconnect(true);
    }

    cancelPendingRemoval(playerId);
    if (emptyRoomTimeout) {
      clearTimeout(emptyRoomTimeout);
      emptyRoomTimeout = null;
    }
    player.disconnected = false;

    console.log(`Jogador ${player.name} voltou (fase: ${gameState.phase}).`);

    // Primeiro o retrato da partida, só para este celular...
    socket.emit("rejoined", buildSnapshot(playerId));

    // ...depois avisa todos de que o jogador voltou.
    if (gameState.phase === "drawing") emitDrawingProgress();
    io.emit("update-lobby", gameState.players);
  });

  // SINCRONIZAÇÃO DA TV: ao (re)conectar, a TV pede o estado atual e recebe os mesmos
  // eventos de sempre, só para ela. Não altera nada no jogo (usa só leituras).
  socket.on("tv-sync", () => {
    if (gameState.phase === "drawing") {
      socket.emit("start-round", gameState.peekRoundData());
      socket.emit("drawing-progress", drawingProgressData());
    } else if (gameState.phase === "voting") {
      socket.emit("start-voting-round", gameState.peekVotingData());
    } else if (gameState.phase === "game-over") {
      socket.emit("game-over", gameState.peekLeaderboard());
    } else {
      socket.emit("back-to-lobby", gameState.players);
      socket.emit("update-lobby", gameState.players);
    }

    if (gameState.phase !== "lobby") socket.emit("timer-tick", roundTimeLeft);
  });

  socket.on("start-game", () => {
    // Impede reiniciar ou iniciar outra partida fora do lobby.
    if (gameState.phase !== "lobby" || gameState.isStarted) {
      socket.emit(
        "error-message",
        "A partida já começou ou não pode ser iniciada agora.",
      );
      return;
    }

    const activePlayers = gameState.players.filter(
      (player) => !player.disconnected,
    );

    if (activePlayers.length < 2) {
      socket.emit(
        "error-message",
        "É necessário pelo menos 2 jogadores para iniciar a partida!",
      );
      return;
    }

    // Usa o primeiro jogador ativo como anfitrião.
    const activeHost = activePlayers[0];

    if (!activeHost || activeHost.id !== socket.data.playerId) {
      socket.emit(
        "error-message",
        "Somente o anfitrião atual pode iniciar a partida.",
      );
      return;
    }

    const roundData = gameState.startGame();

    if (!roundData || !gameState.isStarted) {
      socket.emit(
        "error-message",
        "Não foi possível iniciar a partida. Tente novamente.",
      );
      return;
    }

    io.emit("start-round", roundData);
    startRoundTimer(60, () => handleDrawingCompletion());
  });

  socket.on("submit-drawing", (data, acknowledge) => {
    const reply = (result) => {
      if (typeof acknowledge === "function") {
        acknowledge(result);
      } else if (!result.ok) {
        socket.emit("error-message", result.message);
      }
    };

    const player = gameState.players.find(
      (p) => p.id === socket.data.playerId && !p.disconnected,
    );

    if (!player) {
      return reply({
        ok: false,
        message: "Jogador não encontrado ou desconectado.",
      });
    }

    if (isTransitioning || gameState.phase !== "drawing") {
      return reply({
        ok: false,
        message: "Não há uma rodada de desenho ativa.",
      });
    }

    if (!data || typeof data !== "object") {
      return reply({
        ok: false,
        message: "Dados do desenho inválidos.",
      });
    }

    const result = gameState.submitDrawing(
      socket.data.playerId,
      data.round,
      data.imageData,
    );

    if (!result.ok) {
      return reply(result);
    }

    const activePlayers = gameState.players.filter((p) => !p.disconnected);

    const roundDrawings = gameState.drawings[data.round] || {};

    const submittedActiveCount = activePlayers.filter((player) =>
      Object.prototype.hasOwnProperty.call(roundDrawings, player.id),
    ).length;

    io.emit("drawing-progress", {
      submitted: submittedActiveCount,
      total: activePlayers.length,
    });

    // Confirma o recebimento antes de processar a transição.
    reply({ ok: true });

    if (gameState.allDrawingsSubmitted()) {
      handleDrawingCompletion();
    }
  });

  socket.on("submit-votes", (data, acknowledge) => {
    const reply = (result) => {
      if (typeof acknowledge === "function") {
        acknowledge(result);
      } else if (!result.ok) {
        socket.emit("error-message", result.message);
      }
    };

    const player = gameState.players.find(
      (p) => p.id === socket.data.playerId && !p.disconnected,
    );

    if (!player) {
      return reply({
        ok: false,
        message: "Jogador não encontrado ou desconectado.",
      });
    }

    if (isTransitioning || gameState.phase !== "voting") {
      return reply({
        ok: false,
        message: "Não há uma votação ativa no momento.",
      });
    }

    if (!data || !Array.isArray(data.votes)) {
      return reply({
        ok: false,
        message: "Dados de votação inválidos.",
      });
    }

    const roundNum = data.round;

    if (
      !Number.isInteger(roundNum) ||
      roundNum !== gameState.currentVotingRound
    ) {
      return reply({
        ok: false,
        message: "Esta votação não está mais ativa.",
      });
    }

    const result = gameState.submitVote(
      socket.data.playerId,
      roundNum,
      data.votes,
    );

    if (!result.ok) {
      return reply(result);
    }

    // Confirma ao cliente antes de iniciar a próxima fase.
    reply({ ok: true });

    if (gameState.allVotesSubmitted(roundNum)) {
      handleVotingCompletion(roundNum);
    }
  });

  socket.on("return-to-lobby", () => {
    const activePlayers = gameState.players.filter(
      (player) => !player.disconnected,
    );

    const activeHost = activePlayers[0];

    if (!activeHost) return;

    // Somente o anfitrião ativo pode executar a ação.
    if (activeHost.id !== socket.data.playerId) {
      socket.emit(
        "error-message",
        "Somente o anfitrião atual pode executar esta ação.",
      );
      return;
    }

    const isPodium = gameState.phase === "game-over";

    const canAbortUnderstaffedMatch =
      gameState.isStarted &&
      gameState.phase !== "lobby" &&
      activePlayers.length < 2;

    // Permite retornar ao lobby no pódio ou abortar uma
    // partida que ficou com menos de 2 jogadores ativos.

    if (!isPodium && !canAbortUnderstaffedMatch) {
      socket.emit("error-message", "Esta ação não está disponível nesta fase.");
      return;
    }

    clearRoundTimer();
    isTransitioning = false;

    gameState.returnToLobby();

    io.emit("back-to-lobby", gameState.players);
    io.emit("update-lobby", gameState.players);
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `Dispositivo desconectado: ${socket.id} | motivo: ${reason} | transporte: ${socket.conn.transport.name}`,
    );

    console.log("[DEBUG DISCONNECT]", {
      phase: gameState.phase,
      currentRound: gameState.currentRound,
      currentVotingRound: gameState.currentVotingRound,
      isTransitioning,
      players: gameState.players.map((player) => ({
        name: player.name,
        disconnected: player.disconnected,
      })),
    });

    const playerId = socket.data.playerId;

    // Aparelho que nunca entrou como jogador (ex.: a TV): nada a fazer.
    if (!playerId) return;

    // Conexão antiga de um jogador que já voltou por outra conexão: ignora.
    if (playerSockets.get(playerId) !== socket.id) {
      console.log("Conexão antiga ignorada (o jogador já voltou por outra conexão).");
      return;
    }
    playerSockets.delete(playerId);

    if (gameState.isStarted) {
      // Marca o jogador como desconectado sem apagar seus desenhos.
      if (typeof gameState.setDisconnected === "function") {
        gameState.setDisconnected(socket.data.playerId);
      }

      // Verifica quantos jogadores continuam conectados.
      const activePlayers = gameState.players.filter(
        (player) => !player.disconnected,
      );

      // Se ninguém restar, espera um tempo antes de limpar a sala,
      // para dar chance de todos voltarem (ex.: queda geral de wifi).
      if (activePlayers.length === 0) {
        io.emit("update-lobby", gameState.players);
        scheduleEmptyRoomReset();
        return;
      }

      // Atualiza o progresso dos desenhos após uma desconexão.
      if (gameState.phase === "drawing") {
        const roundDrawings = gameState.drawings[gameState.currentRound] || {};

        const submittedActiveCount = activePlayers.filter((player) =>
          Object.prototype.hasOwnProperty.call(roundDrawings, player.id),
        ).length;

        io.emit("drawing-progress", {
          submitted: submittedActiveCount,
          total: activePlayers.length,
        });
      }

      // Atualiza os clientes para refletir quem continua conectado.
      io.emit("update-lobby", gameState.players);

      // Se todos os jogadores ativos já concluíram a fase,
      // avança normalmente, evitando transições duplicadas.
      if (!isTransitioning) {
        if (gameState.phase === "drawing" && gameState.allDrawingsSubmitted()) {
          handleDrawingCompletion();
        } else if (
          gameState.phase === "voting" &&
          gameState.allVotesSubmitted(gameState.currentVotingRound)
        ) {
          handleVotingCompletion(gameState.currentVotingRound);
        }
      }

      return;
    }

    // No lobby, o jogador fica "ausente" e só é removido se não voltar a tempo.
    gameState.setDisconnected(playerId);
    scheduleLobbyRemoval(playerId);
    io.emit("update-lobby", gameState.players);
  });
});

function handleDrawingCompletion() {
  if (isTransitioning || gameState.phase !== "drawing") return;
  isTransitioning = true;
  clearRoundTimer();

  const currentRound = gameState.currentRound;

  if (currentRound < 3) {
    gameState.currentRound++;
    const roundData = gameState.getCurrentRoundData();
    io.emit("start-round", roundData);
    startRoundTimer(60, () => handleDrawingCompletion());
  } else if (currentRound === 3) {
    const votingCards = gameState.getVotingCards(1);
    io.emit("start-voting-round", votingCards);
    startRoundTimer(30, () => handleVotingCompletion(1));
  } else if (currentRound > 3 && currentRound < 6) {
    gameState.currentRound++;
    const roundData = gameState.getCurrentRoundData();
    io.emit("start-round", roundData);
    startRoundTimer(60, () => handleDrawingCompletion());
  } else if (currentRound === 6) {
    const votingCards = gameState.getVotingCards(4);
    io.emit("start-voting-round", votingCards);
    startRoundTimer(30, () => handleVotingCompletion(4));
  }
}

function handleVotingCompletion(roundNum) {
  if (
    isTransitioning ||
    gameState.phase !== "voting" ||
    roundNum !== gameState.currentVotingRound
  ) {
    return;
  }
  isTransitioning = true;
  clearRoundTimer();

  if (roundNum < 3) {
    const nextRound = roundNum + 1;
    const votingCards = gameState.getVotingCards(nextRound);

    console.log("[DEBUG VOTING SERVER]", {
      completedRound: roundNum,
      requestedRound: nextRound,
      payloadRound: votingCards?.round,
      cardsCount: Array.isArray(votingCards?.cards)
        ? votingCards.cards.length
        : null,
      phase: gameState.phase,
      currentVotingRound: gameState.currentVotingRound,
    });

    io.emit("start-voting-round", votingCards);

    startRoundTimer(30, () => handleVotingCompletion(roundNum + 1));
  } else if (roundNum === 3) {
    gameState.currentRound = 4;
    const roundData = gameState.getCurrentRoundData();
    io.emit("start-round", roundData);
    startRoundTimer(60, () => handleDrawingCompletion());
  } else if (roundNum >= 4 && roundNum < 6) {
    const votingCards = gameState.getVotingCards(roundNum + 1);
    io.emit("start-voting-round", votingCards);
    startRoundTimer(30, () => handleVotingCompletion(roundNum + 1));
  } else if (roundNum === 6) {
    const leaderboard = gameState.calculateFinalLeaderboard();
    gameState.phase = "game-over";
    io.emit("game-over", leaderboard);

    startRoundTimer(45, () => {
      clearRoundTimer();
      isTransitioning = false;
      gameState.returnToLobby();
      io.emit("back-to-lobby", gameState.players);
      io.emit("update-lobby", gameState.players);
    });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});