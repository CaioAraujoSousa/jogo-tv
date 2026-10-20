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

  clearRoundTimer();
  isTransitioning = false;

  gameState.reset();

  // Notifica todos os clientes para voltarem às telas iniciais.
  io.emit("back-to-lobby", []);
  io.emit("update-lobby", []);

  return res.send(
    "<h1>Sala resetada com sucesso. Todos podem entrar novamente.</h1>",
  );
});

// --- CONTROLE DE TEMPORIZADOR E TRAVAS DE ESTADO ---
let roundTimerInterval = null;
let roundTimeoutHandle = null;
let roundTimeLeft = 0;
let isTransitioning = false; // Trava para impedir avanços duplos de rodada

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
  console.log("Novo dispositivo conectado:", socket.id);

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
      (player) => player.id === socket.id,
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
      "",
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

    io.emit("update-lobby", gameState.players);
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

    if (!activeHost || activeHost.id !== socket.id) {
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
      (p) => p.id === socket.id && !p.disconnected,
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
      socket.id,
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
      (p) => p.id === socket.id && !p.disconnected,
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

    const result = gameState.submitVote(socket.id, roundNum, data.votes);

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
    if (activeHost.id !== socket.id) {
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

  socket.on("disconnect", () => {
    console.log(`Dispositivo desconectado: ${socket.id}`);

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

    if (gameState.isStarted) {
      // Marca o jogador como desconectado sem apagar seus desenhos.
      if (typeof gameState.setDisconnected === "function") {
        gameState.setDisconnected(socket.id);
      }

      // Verifica quantos jogadores continuam conectados.
      const activePlayers = gameState.players.filter(
        (player) => !player.disconnected,
      );

      // Se ninguém restar, encerra a sessão imediatamente.
      if (activePlayers.length === 0) {
        clearRoundTimer();
        isTransitioning = false;

        gameState.reset();

        // Sincroniza a TV e todos os clientes com o lobby vazio.
        io.emit("back-to-lobby", []);
        io.emit("update-lobby", []);

        console.log("Todos os jogadores saíram. Sala limpa.");

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

    // No lobby, a saída remove normalmente o jogador.
    gameState.removePlayer(socket.id);
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
    const votingCards = gameState.getVotingCards(roundNum + 1);
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
