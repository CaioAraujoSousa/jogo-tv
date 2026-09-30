# 🎮 Jogo Interativo (TV + Celular via WebSockets)

Uma aplicação web desenvolvida em Node.js que transforma qualquer tela (TV ou monitor) no *host* de um jogo e os smartphones dos jogadores em controles interativos em tempo real, utilizando a mesma arquitetura de jogos da Netflix e AirConsole.

## 🚀 Tecnologias Utilizadas
* **Node.js** & **Express** - Servidor web
* **Socket.IO** - Comunicação WebSocket em tempo real e de baixa latência
* **HTML/CSS/JS Vanilla** - Interfaces fluidas sem dependências pesadas
* **Render** - Hospedagem em nuvem gratuita

## 🧠 Arquitetura
A comunicação funciona através de eventos. O smartphone envia um sinal (`botao_apertado`) para o servidor no momento do toque, e o servidor retransmite essa ação imediatamente para a tela principal (TV), atualizando a interface sem recarregar a página.

## 🛠️ Como rodar localmente
1. Clone este repositório:
   ```bash
   git clone https://github.com/CaioAraujoSousa/jogo-tv.git
