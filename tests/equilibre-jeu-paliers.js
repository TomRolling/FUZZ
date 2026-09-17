// Le JEU avec les paliers de compagnon integres : aucun patch ; la liste des paliers sert
// seulement au bot pour journaliser leur franchissement dans la mesure des temps morts.
const jeu = require('./equilibre-jeu.js');
module.exports = { ...jeu, paliers: [10, 20, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500] };
