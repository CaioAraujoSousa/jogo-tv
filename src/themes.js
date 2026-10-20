
const categories = {
  funnyCharacters: [
    "Um fantasma usando óculos escuros",
    "Um vampiro escovando os dentes",
    "Um zumbi dançando",
    "Um pirata com um papagaio no ombro",
    "Um alienígena com três olhos",
    "Um super-herói com medo de uma aranha",
    "Um mago segurando uma pizza",
    "Um astronauta comendo um hambúrguer",
    "Um ninja com um guarda-chuva",
    "Um rei usando pijama",
    "Um dinossauro tirando uma selfie",
    "Um robô apaixonado",
  ],

  funnyAnimals: [
    "Um gato preso numa caixa pequena",
    "Um cachorro usando uma coroa",
    "Uma capivara de óculos escuros",
    "Um sapo andando de skate",
    "Um pinguim tomando sorvete",
    "Uma galinha usando botas",
    "Um tubarão escovando os dentes",
    "Uma coruja morrendo de sono",
    "Um macaco segurando uma banana gigante",
    "Um pato usando gravata",
    "Uma tartaruga com uma mochila",
    "Um coelho comendo uma cenoura enorme",
  ],

  sillyObjects: [
    "Uma pizza usando bigode",
    "Uma banana escorregando na própria casca",
    "Um hambúrguer com pernas",
    "Uma planta com cabelo",
    "Um celular chorando",
    "Um despertador com cara de bravo",
    "Uma meia procurando seu par",
    "Uma geladeira usando óculos escuros",
    "Um vaso sanitário com capa de super-herói",
    "Uma escova de dentes gigante",
    "Um guarda-chuva voando como um helicóptero",
    "Um pão de queijo usando uma coroa",
  ],
};

const allThemes = [
  ...categories.funnyCharacters,
  ...categories.funnyAnimals,
  ...categories.sillyObjects,
];

function getRandomThemes(count) {
  const array = [...allThemes];

  // Embaralha os temas usando Fisher-Yates.
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  // Retorna até a quantidade solicitada, sem repetir temas.
  return array.slice(0, count);
}

module.exports = { getRandomThemes };
