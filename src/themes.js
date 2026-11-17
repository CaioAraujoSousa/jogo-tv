// Gerador de temas: combina peças aleatórias (Quem + Ação + Detalhe + Lugar).
// O artigo (um/uma) já vem dentro de "Quem". Para mudar o jogo, edite só as listas.

const QUEM = [
  "um pirata", "uma bruxa", "um gato", "um cachorro", "um robô",
  "um zumbi", "uma sereia", "um dinossauro", "um alienígena", "um palhaço",
  "uma vaca", "um pinguim", "um fantasma", "uma princesa", "um cavaleiro",
  "um macaco", "uma galinha", "um tubarão", "um vampiro", "uma tartaruga",
  "um astronauta", "um ninja", "uma girafa", "um jacaré", "um coelho",
  "uma pizza", "um cacto", "uma banana", "um sapo", "um polvo",
  "uma abelha", "um urso", "um pato", "um mágico", "um bebê",
  "uma vovó", "um cowboy", "um rato", "um dragão", "um unicórnio",
  "uma lagarta", "um bolo",
];

const ACOES = [
  "tomando banho", "dançando", "dormindo", "comendo macarrão",
  "andando de patins", "correndo", "pulando corda", "tocando guitarra",
  "escovando os dentes", "pescando", "andando de bicicleta", "cantando",
  "jogando futebol", "tomando sorvete", "voando", "nadando", "cozinhando",
  "lendo um livro", "fazendo careta", "tirando uma selfie", "surfando",
  "espirrando", "plantando uma flor", "pintando uma parede",
  "assistindo TV", "andando de skate", "fazendo ioga", "soprando bolhas",
  "lavando a louça", "bebendo suco", "subindo uma escada", "rindo",
  "chorando", "brincando de esconde-esconde", "soltando pipa",
  "fazendo ginástica", "tomando chuva", "dirigindo", "escorregando",
  "pedindo carona",
];

const DETALHES = [
  "com chapéu de cozinheiro", "com óculos escuros", "com uma coroa",
  "com um guarda-chuva", "com uma capa de super-herói", "com um balão",
  "com gravata", "com botas de chuva", "com uma mochila",
  "com um sorvete na mão", "com um bigode enorme", "com um laço na cabeça",
  "com um boné", "com um cachecol", "com uma bengala", "com uma espada",
  "com um violão", "com um tênis gigante", "com uma flor na cabeça",
  "com um megafone", "com uma bola", "com um cachorro-quente",
  "com uma câmera", "com um chapéu de festa", "com uma lanterna",
  "com pijama", "com um capacete", "com asas de anjo", "com um relógio",
  "com uma varinha mágica", "com fones de ouvido", "com uma mala",
  "com um tutu de bailarina", "com fantasia de abóbora",
];

const LUGARES = [
  "na lua", "dentro de uma geladeira", "no fundo do mar",
  "em cima de uma árvore", "na praia", "no deserto",
  "numa montanha de gelo", "na cozinha", "no banheiro", "numa piscina",
  "no espaço", "numa floresta", "num castelo", "na escola", "no mercado",
  "num trem", "num balão", "na chuva", "numa ilha deserta", "no circo",
  "numa nuvem", "num barco", "dentro de uma caixa", "numa festa",
  "num parque", "no telhado", "num vulcão", "na neve", "no quarto",
  "numa jaula",
];

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Quais peças extras entram (no máximo 2, para não complicar o desenho).
function sortearExtras() {
  const r = Math.random();
  if (r < 0.05) return [];
  const extras = shuffle(["acao", "detalhe", "lugar"]);
  return r < 0.5 ? extras.slice(0, 1) : extras.slice(0, 2);
}

function getRandomThemes(count = 6) {
  // Listas embaralhadas: assim nada se repete dentro da mesma partida.
  const quem = shuffle(QUEM);
  const acoes = shuffle(ACOES);
  const detalhes = shuffle(DETALHES);
  const lugares = shuffle(LUGARES);

  const themes = [];
  for (let i = 0; i < count; i++) {
    const extras = sortearExtras();
    const partes = [quem[i]];
    if (extras.includes("acao")) partes.push(acoes[i]);
    if (extras.includes("detalhe")) partes.push(detalhes[i]);
    if (extras.includes("lugar")) partes.push(lugares[i]);

    const texto = partes.join(" ");
    themes.push(texto.charAt(0).toUpperCase() + texto.slice(1));
  }
  return themes;
}

module.exports = { getRandomThemes };