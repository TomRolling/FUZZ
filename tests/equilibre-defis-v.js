// Variantes de reglage des defis, par variables d'environnement :
//   SORTES = nombre de sortes de compagnons autorisees dans « Jardin minimaliste »
//   OBJECTIFS = JSON { idDuDefi: Graines visees } pour remplacer les objectifs du jeu
const SORTES = parseInt(process.env.SORTES || '5', 10);
const OBJECTIFS = JSON.parse(process.env.OBJECTIFS || '{}');
const jeu = require('./equilibre-jeu-defis.js');
module.exports = {
  ...jeu,
  patch: `
    window.challengeAllowsBuilding = id => {
      if (!challengeIs('minimaliste') || (state.buildings[id] || 0) > 0) return true;
      return Object.values(state.buildings).filter(n => n > 0).length < ${SORTES};
    };
    const OBJ = ${JSON.stringify(OBJECTIFS)};
    for (const c of CHALLENGES) if (OBJ[c.id] != null) c.goal = OBJ[c.id];
  `,
};
