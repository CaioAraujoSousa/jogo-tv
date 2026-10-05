export function renderVotingScreen(container, data, socket) {
    container.innerHTML = '';

    // --- COLI AQUI O BLOCO ABAIXO ---
    if (!data || !Array.isArray(data.cards)) {
        container.innerHTML = '«div class="card"»«h2»Aguardando votação... ⏳«/h2»«/div»';
        return;
    }

    // Conta apenas desenhos que pertencem a OUTROS jogadores
    const otherCardsCount = data.cards.filter(c => c.artistId !== socket.id).length;

    // Limita a no máximo 3 votos (1º, 2º e 3º) conforme a regra de pontuação
    const maxVotes = Math.min(3, otherCardsCount);
    let selectedVotes = [];

    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    const title = document.createElement('h2');
    title.style.color = '#facc15';
    title.style.marginBottom = '5px';
    title.textContent = 'Votação • Rodada ' + data.round;

    const subtitle = document.createElement('p');
    subtitle.style.color = '#94a3b8';
    subtitle.style.fontSize = '0.9rem';
    subtitle.style.marginTop = '0';

    const grid = document.createElement('div');
    grid.className = 'vote-grid';

    const sendBtn = document.createElement('button');
    sendBtn.id = 'send-vote-btn';
    sendBtn.style.marginTop = '15px';

    function updateUI() {
        subtitle.textContent = 'Escolha os seus favoritos por ordem (' + selectedVotes.length + '/' + maxVotes + ')';
        grid.innerHTML = '';

        data.cards.forEach((card) => {
            const isMyDrawing = (card.artistId === socket.id);
            const voteIndex = selectedVotes.indexOf(card.number);
            const isSelected = (voteIndex !== -1);

            const btn = document.createElement('button');
            btn.className = 'vote-btn';

            if (isMyDrawing) {
                btn.classList.add('disabled');
                btn.disabled = true;
            } else {
                btn.style.backgroundColor = card.color;
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = 'Desenho ' + card.number;
            btn.appendChild(labelSpan);

            if (isMyDrawing) {
                const badge = document.createElement('span');
                badge.className = 'vote-badge';
                badge.textContent = 'Seu';
                btn.appendChild(badge);
            } else if (isSelected) {
                const badge = document.createElement('span');
                badge.className = 'vote-badge';
                badge.textContent = (voteIndex + 1) + 'º Lugar';
                btn.appendChild(badge);
            }

            btn.addEventListener('click', () => {
                if (isMyDrawing) return;

                const idx = selectedVotes.indexOf(card.number);
                if (idx !== -1) {
                    selectedVotes.splice(idx, 1);
                } else {
                    if (selectedVotes.length < maxVotes) {
                        selectedVotes.push(card.number);
                    }
                }
                updateUI();
            });

            grid.appendChild(btn);
        });

        const isReady = (selectedVotes.length === maxVotes);
        const remaining = maxVotes - selectedVotes.length;

        if (maxVotes === 0) {
    // Caso só exista o próprio desenho na rodada
    sendBtn.textContent = 'Avançar (Apenas seu desenho na tela) 🚀';
    sendBtn.disabled = false;
    sendBtn.style.background = '#22c55e';
    sendBtn.style.opacity = '1';
    sendBtn.style.cursor = 'pointer';
} else if (isReady) {
    sendBtn.textContent = 'Confirmar Votos 🚀';
    sendBtn.disabled = false;
    sendBtn.style.background = '#22c55e';
    sendBtn.style.opacity = '1';
    sendBtn.style.cursor = 'pointer';
} else {
    sendBtn.textContent = 'Selecione ' + remaining + ' preferência(s)';
    sendBtn.disabled = true;
    sendBtn.style.background = '#64748b';
    sendBtn.style.opacity = '0.5';
    sendBtn.style.cursor = 'not-allowed';
}
    }

    sendBtn.addEventListener('click', () => {
        if (selectedVotes.length !== maxVotes && maxVotes > 0) return;

        // Desativa o botão no clique para evitar lag e duplo envio
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        sendBtn.textContent = 'Enviando votos... ⏳';

        socket.emit('submit-votes', { round: data.round, votes: selectedVotes });

        cardDiv.innerHTML = '';
        const doneTitle = document.createElement('h2');
        doneTitle.textContent = 'Votos Enviados! 🎯';

        const doneText = document.createElement('p');
        doneText.style.color = '#94a3b8';
        doneText.textContent = 'Aguardando os restantes jogadores votarem...';

        cardDiv.appendChild(doneTitle);
        cardDiv.appendChild(doneText);
    });

    cardDiv.appendChild(title);
    cardDiv.appendChild(subtitle);
    cardDiv.appendChild(grid);
    cardDiv.appendChild(sendBtn);

    container.appendChild(cardDiv);

    updateUI();
}