// Variante : bonus de Graines des Eclats en racine carree (+25 % x racine des Eclats gagnes).
const base = require('./equilibre-jeu-paliers.js');
module.exports = { ...base, patch: (base.patch || '') + "\nwindow.shardSeedMultiplier = () => 1 + 0.25 * Math.sqrt(state.totalShardsEarned || 0);\n" };
