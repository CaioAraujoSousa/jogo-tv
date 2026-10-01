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
        this.players = [];
        this.isStarted = false;
        this.currentRound = 0;
        this.currentVotingRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
    }

    reset() {
        this.players = [];
        this.isStarted = false;
        this.currentRound = 0;
        this.currentVotingRound = 0;
        this.matchThemes = [];
        this.drawings = {};
        this.votes = {};
    }

    addPlayer(id, name, avatar) {
        const newPlayer = { id, name, avatar: avatar || '🦊', score: 0 };
        this.players.push(newPlayer);
        return newPlayer;
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
        this.isStarted = true;
        this.currentRound = 1;
        this.currentVotingRound = 0;
        this.matchThemes = getRandomThemes(6);
        this.drawings = {};
        this.votes = {};
        this.players.forEach(p => p.score = 0);
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

    allDrawingsSubmitted() {
        const roundDrawings = this.drawings[this.currentRound] || {};
        return Object.keys(roundDrawings).length >= this.players.length;
    }

    submitVote(playerId, roundNum, votesArray) {
        if (!this.votes[roundNum]) {
            this.votes[roundNum] = {};
        }
        this.votes[roundNum][playerId] = votesArray;
        return Object.keys(this.votes[roundNum]).length;
    }

    allVotesSubmitted(roundNum) {
        const roundVotes = this.votes[roundNum] || {};
        return Object.keys(roundVotes).length >= this.players.length;
    }

    getVotingCards(roundNum) {
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
                if (voteList[0] && artistMap[voteList[0]]) {
                    const p = this.players.find(player => player.id === artistMap[voteList[0]]);
                    if (p) p.score += 50;
                }
                if (voteList[1] && artistMap[voteList[1]]) {
                    const p = this.players.find(player => player.id === artistMap[voteList[1]]);
                    if (p) p.score += 30;
                }
                if (voteList[2] && artistMap[voteList[2]]) {
                    const p = this.players.find(player => player.id === artistMap[voteList[2]]);
                    if (p) p.score += 20;
                }
            });
        }

        return [...this.players].sort((a, b) => b.score - a.score);
    }
}

module.exports = new GameState();