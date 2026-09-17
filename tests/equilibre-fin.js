// Fin de partie : meme jeu que equilibre-jeu-paliers, sans arret apres 8 Ascensions (pour voir
// jusqu'ou le contenu tient, autour de 3 semaines).
module.exports = { ...require('./equilibre-jeu-paliers.js'), stopApresAscensions: 0 };
