# 🎨 Cinema do Desenho

Jogo multiplayer de desenho e votação, estilo jogo de festa. A **TV (ou computador)** é a tela principal e cada jogador usa o **próprio celular** como controle: entra com apelido e avatar, recebe um tema, desenha, envia e depois vota nos desenhos dos outros. No fim, há um pódio.

🔗 **Jogar online:** https://jogo-tv.onrender.com
> A hospedagem é gratuita e "dorme" após inatividade. O primeiro acesso pode demorar cerca de 1 minuto.

## 🕹️ Como jogar
1. Abra o site na **TV ou no computador**. Aparece um QR Code.
2. Cada jogador escaneia o QR Code no celular, escolhe um apelido e um avatar.
3. O primeiro jogador a entrar é o **anfitrião** e inicia a partida.
4. Em cada rodada, todos desenham o tema recebido (60 segundos).
5. Depois, todos votam nos desenhos dos outros (30 segundos). Não dá para votar no próprio.
6. A TV revela quem desenhou cada um e quem votou em quem.
7. No fim, o pódio mostra os vencedores.

## 📜 Regras
- De **2 a 8 jogadores**. Só é possível entrar durante o lobby.
- Sequência fixa: Desenho 1, 2, 3 → Votação 1, 2, 3 → Desenho 4, 5, 6 → Votação 4, 5, 6 → Pódio.
- Cada rodada tem um tema diferente (6 por partida).
- Cada jogador vota em até 3 desenhos: **1º lugar = 50 pts, 2º = 30 pts, 3º = 20 pts**.
- A ordem dos desenhos é embaralhada, então ninguém sabe de quem é cada um.
- Empates dividem a mesma posição no pódio.
- Apelido com até 12 caracteres e único. Cada avatar só pode ser usado por um jogador.
- Quem desconecta durante a partida **continua na competição** e pode voltar ao mesmo jogador.
- Após o pódio, o jogo volta sozinho ao lobby em 10 segundos.

## 🧰 Tecnologias
- **Node.js** e **Express**: servidor web
- **Socket.IO**: comunicação em tempo real
- **HTML, CSS e JavaScript** puros, com **Canvas API** para o desenho
- **Render**: hospedagem

## 🧠 Arquitetura
O **servidor é a fonte da verdade**: fases, rodadas, timers, votos e pontuação ficam no servidor. TV e celulares apenas reagem aos eventos e pedem ressincronização quando precisam.

- A identidade do jogador **não depende da conexão**: ao entrar, ele recebe um token guardado no aparelho. Se a conexão cair, ele volta como o mesmo jogador.
- A TV pede o estado atual ao conectar, ao reconectar e ao voltar para a aba.

## 📁 Estrutura
```
jogo-tv/
├── server.js            # servidor, eventos e timers
├── src/
│   ├── gameState.js     # estado do jogo, votos e pontuação
│   └── themes.js        # temas aleatórios
├── public/
│   ├── index.html       # tela da TV
│   ├── controle.html    # tela do celular
│   ├── css/             # tv.css, controle.css
│   └── js/              # tv.js, controle.js
│       └── modules/     # canvasEngine, votingEngine, soundEngine
└── test/
    └── bots.js          # jogadores robôs para testes
```

## 🛠️ Rodando localmente
Requisitos: [Node.js](https://nodejs.org) instalado.

```bash
git clone https://github.com/CaioAraujoSousa/jogo-tv.git
cd jogo-tv
npm install
npm start
```

- **TV:** http://localhost:3000
- **Celular:** `http://IP-DO-SEU-COMPUTADOR:3000/controle.html` (o celular precisa estar na mesma rede Wi-Fi; no Windows, libere a porta 3000 no firewall se necessário)

## ⚙️ Variáveis de ambiente
| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | 3000 |
| `RESET_TOKEN` | Chave para `POST /reset` (header `x-reset-token`). Sem ela, o reset fica desativado | não definida |
| `LOBBY_GRACE_MS` | Tempo até remover do lobby quem caiu | 30000 |
| `EMPTY_ROOM_MS` | Tempo até limpar a sala se todos saírem durante a partida | 30000 |

## 🧪 Testes automatizados
Com o servidor ligado (`npm start`), em outro terminal:

```bash
node test/bots.js            # 4 bots, partida completa
node test/bots.js 8          # 8 bots
node test/bots.js 4 --kb=200 # desenhos pesados
```

Cenários disponíveis: `--drop-lobby`, `--drop`, `--drop-voting`, `--tv-reload`, `--no-return`, `--last-leaves`, `--last-return`, `--host-drops`, `--host-drops-playing`, `--rejoin-many` e `--human` (você joga junto com os bots).

> Os bots testam a comunicação (eventos Socket.IO), não a aparência das telas.

## 📄 Licença
Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).