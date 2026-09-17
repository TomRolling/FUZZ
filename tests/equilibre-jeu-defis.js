// Le JEU (paliers + automatisations + defis integres), le bot lancant chaque defi des qu'il est offert.
const jeu = require('./equilibre-jeu-paliers.js');
module.exports = { ...jeu, defis: true };
