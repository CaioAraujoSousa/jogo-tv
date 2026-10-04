// themes.js
const categories = {
    popCulture: [
        "Sonic e Chaves a comer churros numa praça",
        "Batman a tentar adivinhar a senha do Wi-Fi",
        "Homem-Aranha preso numa teia de aranha gigante",
        "Goku a fazer compras num supermercado lotado",
        "Shrek num salão de beleza a fazer a barba",
        "Darth Vader a tentar abrir um pacote de bolachas"
    ],
    funnySituations: [
        "Um pinguim a surfar num vulcão em erupção",
        "Zumbi a fazer ioga na praia",
        "Abacaxi detetive a investigar um roubo de pizza",
        "T-Rex a tentar pintar as unhas com esmalte rosa",
        "Vampiro a tomar banho de sol com protetor solar",
        "Esqueleto a tentar passar desodorante"
    ],
    animals: [
        "Gato astronauta a caçar um rato alienígena",
        "Cachorro a conduzir um autocarro cheio de patos",
        "Urso panda a tocar guitarra elétrica num show de rock",
        "Capivara de terno a negociar na bolsa de valores",
        "Girafa a tentar andar de skate num parque"
    ]
};

const allThemes = [
    ...categories.popCulture,
    ...categories.funnySituations,
    ...categories.animals
];

function getRandomThemes(count) {
    const array = [...allThemes];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array.slice(0, count);
}

module.exports = { getRandomThemes };