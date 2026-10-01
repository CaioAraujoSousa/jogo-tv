// themes.js
const categories = {
    popCulture: [
        "Sonic e Chaves a comer churros numa praça",
        "Batman a tentar adivinhar a senha do Wi-Fi",
        "Homem-Aranha preso numa teia de aranha gigante",
        "Goku a fazer compras num supermercado lotado"
    ],
    funnySituations: [
        "Um pinguim a surfar num vulcão em erupção",
        "Zumbi a fazer ioga na praia",
        "Abacaxi detetive a investigar um roubo de pizza",
        "T-Rex a tentar pintar as unhas com esmalte rosa"
    ],
    animals: [
        "Gato astronauta a caçar um rato alienígena",
        "Cachorro a conduzir um autocarro cheio de patos",
        "Urso panda a tocar guitarra elétrica num show de rock"
    ]
};

// Junta todos os temas numa lista única para sortear facilmente
const allThemes = [
    ...categories.popCulture,
    ...categories.funnySituations,
    ...categories.animals
];

// A FUNÇÃO QUE ESTAVA FALTANDO!
// Ela embaralha a lista completa e pega a quantidade exata de temas solicitada (neste caso, 6)
function getRandomThemes(count) {
    const shuffled = [...allThemes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Exporta a função corretamente para o server.js
module.exports = { getRandomThemes };