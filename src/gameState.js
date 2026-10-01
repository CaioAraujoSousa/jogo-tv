const { getRandomThemes } = require('../themes');

const COLOR_PALETTE = [
    '#a855f7', // 1 - Roxo
    '#22c55e', // 2 - Verde
    '#f97316', // 3 - Laranja
    '#3b82f6', // 4 - Azul
    '#ec4899', // 5 - Rosa
    '#eab308', // 6 - Amarelo
    '#06b6d4', // 7 - Ciano
    '#ef4444'  // 8 - Vermelho
];

class GameState {
    constructor() {
        this.players = [];
        this.isStarted = false;
        this.currentRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
    }

    reset() {
        this.players = [];
        this.isStarted = false;
        this.currentRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
    }

    addPlayer(id, name, avatar) {
        const newPlayer = {
            id,
            name,
            avatar: avatar || '🦊',
            score: 0
        };
        this.players.push(newPlayer);
        return newPlayer;
    }

    removePlayer(id) {
        const index = this.players.findIndex(p => p.id === id);
        if (index !== -1) {
            this.players.splice(index, 1);
        }
        // Se restar 1 ou 0 jogadores, reseta o estado da partida para liberar novos logins
        if (this.players.length <= 1) {
            this.isStarted = false;
        }
        if (this.players.length === 0) {
            this.reset();
        }
        return this.players;
    }

    startGame() {
        this.isStarted = true;
        this.currentRound = 1;
        this.matchThemes = getRandomThemes(6);
        this.drawings = {};
        this.votes = {};
        return this.getCurrentRoundData();
    }

    getCurrentRoundData() {
        return {
            round: this.currentRound,
            theme: this.matchThemes[this.currentRound - 1]
        };
    }

    submitDrawing(playerId, imageData) {
        const round = this.currentRound;
        if (!this.drawings[round]) {
            this.drawings[round] = {};
        }
        this.drawings[round][playerId] = imageData;
        return Object.keys(this.drawings[round]).length;
    }

    getVotingCards(roundNum) {
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
}

module.exports = new GameState();