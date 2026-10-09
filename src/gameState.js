let getRandomThemes;
try {
    getRandomThemes = require('../themes').getRandomThemes;
} catch (e) {
    try {
        getRandomThemes = require('./themes').getRandomThemes;
    } catch (err) {
        getRandomThemes = (count) => [
            "Zumbi a fazer ioga na praia",
            "Gato astronauta a comer pizza",
            "Pirata a andar de patins",
            "Dinossauro a tocar guitarra",
            "Robô a cozinhar um bolo",
            "Super-herói a lavar a louça"
        ];
    }
}

const COLOR_PALETTE = [
    '#a855f7', '#22c55e', '#f97316', '#3b82f6',
    '#ec4899', '#eab308', '#06b6d4', '#ef4444'
];

class GameState {
    constructor() {
        this.phase = 'lobby';
        this.players = [];
        this.isStarted = false;
        this.currentRound = 0;
        this.currentVotingRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
    }

    returnToLobby() {
        this.phase = 'lobby';
        this.isStarted = false;
        this.currentRound = 0;
        this.currentVotingRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
        
        // Remove jogadores que caíram durante a partida e reseta os ativos
        this.players = this.players.filter(p => !p.disconnected);
        this.players.forEach(p => {
            p.score = 0;
            p.disconnected = false;
        });
    }

    reset() {
        this.phase = 'lobby';
        this.players = [];
        this.isStarted = false;
        this.currentRound = 0;
        this.currentVotingRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
    }

    addPlayer(id, name, avatar) {
        const newPlayer = { id, name, avatar: avatar || '🦊', score: 0, disconnected: false };
        this.players.push(newPlayer);
        return newPlayer;
    }

    setDisconnected(id) {
        const player = this.players.find(p => p.id === id);
        if (player) {
            player.disconnected = true;
        }
    }

    removePlayer(id) {
        const index = this.players.findIndex(p => p.id === id);
        if (index !== -1) {
            this.players.splice(index, 1);
        }
        if (this.players.length <= 1) {
            this.isStarted = false;
        }
        if (this.players.length === 0) {
            this.reset();
        }
        return this.players;
    }

    startGame() {
        this.phase = 'drawing';
        if (this.players.length < 3) return null;

        this.isStarted = true;
        this.currentRound = 1;
        this.currentVotingRound = 0;
        this.matchThemes = getRandomThemes(6);
        this.drawings = {};
        this.votes = {};
        this.players.forEach(p => {
            p.score = 0;
            p.disconnected = false;
        });
        return this.getCurrentRoundData();
    }

    getCurrentRoundData() {
        this.phase = 'drawing';
        return {
            round: this.currentRound,
            theme: this.matchThemes[this.currentRound - 1]
        };
    }

    submitDrawing(playerId, roundNum, imageData) {
        if (this.phase !== 'drawing') {
            return {
                ok: false,
                message: 'Não há uma rodada de desenho ativa.'
            };
        }

        if (
            !Number.isInteger(roundNum) ||
            roundNum !== this.currentRound
        ) {
            return {
                ok: false,
                message: 'Esta rodada de desenho não está mais ativa.'
            };
        }

        const player = this.players.find(
            p => p.id === playerId && !p.disconnected
        );

        if (!player) {
            return {
                ok: false,
                message: 'Jogador não encontrado ou desconectado.'
            };
        }

        if (
            typeof imageData !== 'string' ||
            !imageData.startsWith('data:image/jpeg;base64,') ||
            imageData.length > 900_000
        ) {
            return {
                ok: false,
                message: 'Imagem inválida ou grande demais.'
            };
        }

        const roundDrawings = this.drawings[roundNum] || {};

        if (
            Object.prototype.hasOwnProperty.call(
                roundDrawings,
                playerId
            )
        ) {
            return {
                ok: false,
                message: 'Você já enviou seu desenho nesta rodada.'
            };
        }

        if (!this.drawings[roundNum]) {
            this.drawings[roundNum] = {};
        }

        this.drawings[roundNum][playerId] = imageData;

        return {
            ok: true,
            submittedCount: Object.keys(
                this.drawings[roundNum]
            ).length
        };
    }

    allDrawingsSubmitted() {
        const roundDrawings = this.drawings[this.currentRound] || {};
        const activePlayers = this.players.filter(p => !p.disconnected);

        if (activePlayers.length === 0) return true;

        return activePlayers.every(player =>
        Object.prototype.hasOwnProperty.call(roundDrawings, player.id)
    );
    }

    submitVote(playerId, roundNum, votesArray) {
    if (this.phase !== 'voting') {
        return {
            ok: false,
            message: 'Não há uma votação ativa no momento.'
        };
    }

    if (
        !Number.isInteger(roundNum) ||
        roundNum !== this.currentVotingRound
    ) {
        return {
            ok: false,
            message: 'Esta votação não está mais ativa.'
        };
    }

    const player = this.players.find(
        p => p.id === playerId && !p.disconnected
    );

    if (!player) {
        return {
            ok: false,
            message: 'Jogador não encontrado ou desconectado.'
        };
    }

    if (!Array.isArray(votesArray)) {
        return {
            ok: false,
            message: 'Formato de votação inválido.'
        };
    }

    const roundVotes = this.votes[roundNum] || {};

    // Se o jogador já votou, só aceitamos uma repetição
    // idêntica para permitir uma confirmação de rede repetida.
    if (
        Object.prototype.hasOwnProperty.call(
            roundVotes,
            playerId
        )
    ) {
        const previousVotes = roundVotes[playerId];

        const isIdentical =
            previousVotes.length === votesArray.length &&
            previousVotes.every(
                (vote, index) => vote === votesArray[index]
            );

        if (isIdentical) {
            return {
                ok: true,
                duplicate: true
            };
        }

        return {
            ok: false,
            message: 'Você já confirmou seus votos nesta rodada.'
        };
    }

    // Reconstrói o mapeamento oficial dos desenhos desta rodada.
    const roundDrawings = this.drawings[roundNum] || {};

    const cards = Object.keys(roundDrawings).map(
        (artistId, index) => ({
            number: index + 1,
            artistId
        })
    );

    const artistByNumber = new Map(
        cards.map(card => [card.number, card.artistId])
    );

    const otherCardsCount = cards.filter(
        card => card.artistId !== playerId
    ).length;

    const expectedVotes = Math.min(3, otherCardsCount);

    if (votesArray.length !== expectedVotes) {
        return {
            ok: false,
            message: `Você precisa selecionar ${expectedVotes} preferência(s).`
        };
    }

    if (!votesArray.every(Number.isInteger)) {
        return {
            ok: false,
            message: 'Os números dos desenhos são inválidos.'
        };
    }

    if (new Set(votesArray).size !== votesArray.length) {
        return {
            ok: false,
            message: 'Você não pode votar no mesmo desenho mais de uma vez.'
        };
    }

    for (const vote of votesArray) {
        if (!artistByNumber.has(vote)) {
            return {
                ok: false,
                message: 'Um dos desenhos selecionados não existe.'
            };
        }

        if (artistByNumber.get(vote) === playerId) {
            return {
                ok: false,
                message: 'Você não pode votar no próprio desenho.'
            };
        }
    }

    if (!this.votes[roundNum]) {
        this.votes[roundNum] = {};
    }

    // Copia a lista para não manter uma referência ao array do cliente.
    this.votes[roundNum][playerId] = [...votesArray];

    return {
        ok: true,
        duplicate: false
    };
}

    allVotesSubmitted(roundNum) {
        const roundVotes = this.votes[roundNum] || {};
        const activePlayers = this.players.filter(p => !p.disconnected);

        if (activePlayers.length === 0) return true;

        return activePlayers.every(player =>
            Object.prototype.hasOwnProperty.call(roundVotes, player.id)
        );
    }

    getVotingCards(roundNum) {
        this.phase = 'voting';
        this.currentVotingRound = roundNum;
        const theme = this.matchThemes[roundNum - 1];
        const roundDrawings = this.drawings[roundNum] || {};

        const cards = Object.keys(roundDrawings).map((playerId, index) => {
            return {
                number: index + 1,
                color: COLOR_PALETTE[index % COLOR_PALETTE.length],
                artistId: playerId,
                imageData: roundDrawings[playerId]
            };
        });

        return {
            round: roundNum,
            theme: theme,
            cards: cards
        };
    }

    calculateFinalLeaderboard() {
        this.players.forEach(p => p.score = 0);

        for (let r = 1; r <= 6; r++) {
            const roundDrawings = this.drawings[r] || {};
            const roundVotes = this.votes[r] || {};

            const artistMap = {};
            Object.keys(roundDrawings).forEach((artistId, index) => {
                artistMap[index + 1] = artistId;
            });

            Object.values(roundVotes).forEach(voteList => {
                if (voteList && voteList[0] && artistMap[voteList[0]]) {
                    const p = this.players.find(player => player.id === artistMap[voteList[0]]);
                    if (p) p.score += 50;
                }
                if (voteList && voteList[1] && artistMap[voteList[1]]) {
                    const p = this.players.find(player => player.id === artistMap[voteList[1]]);
                    if (p) p.score += 30;
                }
                if (voteList && voteList[2] && artistMap[voteList[2]]) {
                    const p = this.players.find(player => player.id === artistMap[voteList[2]]);
                    if (p) p.score += 20;
                }
            });
        }

        return [...this.players].sort((a, b) => b.score - a.score);
    }
}

module.exports = new GameState();