// Joueur qui ne clique pas : ses clics ne rapportent rien (il ne vit que de la production).
module.exports = { ...require('./equilibre-fin.js'), patch: `window.clickGain = () => 0;` };
