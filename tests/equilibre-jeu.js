// Le JEU tel qu'il est maintenant (equilibrage v9 applique dans dist/index.html) : aucun patch,
// seuls les parametres des evenements, que le bot simule lui-meme, doivent correspondre au jeu.
module.exports = {
  golden: { min: 180, max: 360, instantSec: 25, boostMult: 2, boostSec: 25 },
  butterfly: { min: 240, max: 480, mult: 1.5, sec: 60 },
  prestigePolicy: 1,
  ascensionPolicy: 1,
  stopApresAscensions: 8,
  patch: '',
};
