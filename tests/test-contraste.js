// Lisibilite : aucun texte affiche ne doit se confondre avec son fond, quel que soit le theme.
// Les themes 4 et 5 imposent un texte clair sur <body> ; tout element qui pose un fond clair
// sans fixer sa couleur de texte devient alors illisible (c'est arrive au badge meteo et a la
// banniere « Papi debarque »). On mesure le contraste WCAG reel de chaque texte visible.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

const SEUIL = 4.5;       // norme WCAG AA pour du texte courant
const SEUIL_GRAND = 3;   // texte de 18 px et plus (ou 14 px gras)

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => fail('pageerror:', e.message));
  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 4e12, knowledge: 180, cosmicSeeds: 12, totalSeedsEarned: 40, prestigeCount: 5, totalAscensions: 1, stellarShards: 2 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 12).map((b, i) => [b.id, 40 - i * 2]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(900);

  const mesure = () => p.evaluate(() => {
    const lum = (c) => {
      const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    // Le fond de la page est un DEGRADE : backgroundColor y vaut « transparent ». L'ignorer
    // revenait a ne jamais mesurer les textes poses directement sur le jardin — c'est-a-dire la
    // consigne « CLIC » et la barre d'objectif, qui etaient justement les moins lisibles du jeu.
    // On repeint donc le meme degrade dans un canvas pour lire la vraie couleur sous chaque texte.
    const toile = (() => {
      const cv = document.createElement('canvas');
      cv.width = innerWidth; cv.height = innerHeight;
      const ctx = cv.getContext('2d');
      const img = getComputedStyle(document.body).backgroundImage;
      const stops = [...img.matchAll(/rgba?\(([^)]+)\)\s+([\d.]+)%/g)].map(m => ({ c: m[1].split(',').map(Number), p: +m[2] / 100 }));
      if (!stops.length) return null;
      const cx = innerWidth * 0.2, cy = 0;
      const rayon = Math.max(Math.hypot(cx, cy), Math.hypot(innerWidth - cx, cy), Math.hypot(cx, innerHeight - cy), Math.hypot(innerWidth - cx, innerHeight - cy));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rayon);
      for (const st of stops) g.addColorStop(st.p, 'rgb(' + st.c.slice(0, 3).join(',') + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      return (x, y) => {
        const px = Math.max(0, Math.min(cv.width - 1, Math.round(x)));
        const py = Math.max(0, Math.min(cv.height - 1, Math.round(y)));
        const i = (py * cv.width + px) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };
    })();
    // Fond effectif : on remonte les parents jusqu'a un fond opaque (ou un degrade de <body>).
    const fondDe = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const st = getComputedStyle(e);
        const c = parse(st.backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.55)) return c.slice(0, 3);
        if (st.backgroundImage && st.backgroundImage !== 'none' && e === document.body && toile) {
          const r = el.getBoundingClientRect();
          return toile(r.left + r.width / 2, r.top + r.height / 2);
        }
      }
      return null;
    };
    const visible = (el) => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.2) return false;
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent.trim();
      if (t.length < 2) continue;
      // Un emoji s'affiche avec ses propres couleurs, la couleur CSS ne le concerne pas :
      // mesurer son contraste n'a pas de sens. On ne garde que ce qui contient des caracteres.
      if (!/[\p{L}\p{N}]/u.test(t)) continue;
      const el = n.parentElement;
      if (!el) continue;
      let cache = false;
      for (let e = el; e && e !== document.body; e = e.parentElement) if (!visible(e)) { cache = true; break; }
      if (cache) continue;
      const st = getComputedStyle(el);
      const fond = fondDe(el);
      if (!fond) continue; // pose sur le degrade du fond : non mesurable de facon fiable
      // Transparence du texte : couleur semi-transparente ET opacite (animation comprise — on
      // retient le creux, le moment ou le texte est le moins lisible).
      const c = parse(st.color);
      const alphaCouleur = c[3] === undefined ? 1 : c[3];
      let alpha = alphaCouleur * (+st.opacity || 1);
      for (const a of (el.getAnimations ? el.getAnimations() : [])) {
        const vals = ((a.effect && a.effect.getKeyframes) ? a.effect.getKeyframes() : [])
          .map(k => k.opacity !== undefined ? +k.opacity : null).filter(v => v !== null);
        if (vals.length) alpha = alphaCouleur * Math.min(...vals);
      }
      const texte = [0, 1, 2].map(i => Math.round(alpha * c[i] + (1 - alpha) * fond[i]));
      const l1 = lum(texte), l2 = lum(fond);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const taille = parseFloat(st.fontSize);
      const gras = (parseInt(st.fontWeight, 10) || 400) >= 600;
      out.push({
        texte: t.slice(0, 40), ratio: Math.round(ratio * 10) / 10,
        couleurs: `texte ${st.color} sur fond rgb(${fond.join(',')})`,
        grand: taille >= 18 || (taille >= 14 && gras),
        ou: (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()),
      });
    }
    return out;
  });

  // Ecran principal, puis chaque fenetre : les memes couleurs servent dans les panneaux.
  const VUES = [
    ['ecran principal', () => { for (const id of ['shopPageOverlay', 'questsModalOverlay', 'achievementsModalOverlay', 'settingsModalOverlay']) if (isOverlayOpen(id)) closeModal(id); }],
    ['magasin production', () => { openModal('shopPageOverlay'); activeShopTab = 'production'; }],
    ['magasin prestige', () => { activeShopTab = 'prestige'; }],
    ['magasin ascension', () => { activeShopTab = 'ascension'; }],
    ['magasin recherche', () => { activeShopTab = 'recherche'; }],
    ['quetes', () => { closeModal('shopPageOverlay'); openModal('questsModalOverlay'); activeQuestsTab = 'quetes'; }],
    ['succes', () => { closeModal('questsModalOverlay'); openModal('achievementsModalOverlay'); }],
    ['options', () => { closeModal('achievementsModalOverlay'); openModal('settingsModalOverlay'); activeSettingsTab = 'options'; }],
    ['stats', () => { activeSettingsTab = 'stats'; }],
  ];

  // Ces éléments portent des chiffres qu'on lit en permanence : ils doivent rester lisibles
  // dans TOUS les thèmes, sans exception.
  // On y ajoute les chiffres du magasin : un prix illisible l'est dans TOUS les themes, donc la
  // comparaison entre themes ci-dessous ne peut pas l'attraper. Seul un seuil absolu le voit.
  const ELEMENTS_CLES = ['#verdureCount', '#rateText', '#seedsText', '#knowledgeText',
    '#weatherBadge', '#eventBadge', '.invasiveBox',
    '.price', '.prodLine', '.palierBonus', '.achvBonus', '.dayReward', '.owned'];

  // Le reste est mesuré par comparaison : ce qu'on traque, c'est un texte lisible sur le thème
  // clair qui devient illisible sur un thème sombre (il pose un fond clair sans fixer sa
  // couleur, donc il hérite du texte clair de <body>). Un contraste bas identique dans tous les
  // thèmes relève du style général du jeu, pas d'une régression : il n'est pas signalé ici.
  const parTheme = {};
  for (const theme of ['theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'theme-1 darkOverride', 'theme-5 darkOverride']) {
    parTheme[theme] = {};
    for (const [nomVue, preparer] of VUES) {
      await p.evaluate(([t, src]) => {
        // renderAll reapplique le theme correspondant a l'avancement de la partie : on remplace
        // donc la fonction qui le choisit, sinon le test mesure cinq fois le meme theme.
        window.getThemeClass = () => t.split(' ')[0];
        state.forceDarkMode = t.includes('darkOverride');
        _themeApplique = '';
        document.getElementById('bodyEl').className = t;
        state.invasiveWeed = { active: true, needed: 5, done: 2 }; // banniere « Papi debarque »
        _evenementForce = 'halloween';                            // badge de saison
        hideDialogue(false);
        eval('(' + src + ')()');
        renderAll();
      }, [theme, preparer.toString()]);
      await p.waitForTimeout(200);
      for (const m of await mesure()) {
        const cle = `${nomVue} | ${m.ou} | ${m.texte}`;
        const seuil = m.grand ? SEUIL_GRAND : SEUIL;
        if (!parTheme[theme][cle] || parTheme[theme][cle].ratio > m.ratio) parTheme[theme][cle] = { ...m, seuil };
      }
      if (theme === 'theme-1') continue;
    }
    // Éléments clés : seuil absolu, un signalement par élément.
    for (const sel of ELEMENTS_CLES) {
      const fautifs = Object.values(parTheme[theme]).filter(m => m.ou === sel && m.ratio < m.seuil);
      if (fautifs.length) {
        const pire = fautifs.reduce((a, b) => (a.ratio <= b.ratio ? a : b));
        fail(`${theme} : contraste ${pire.ratio} sur ${sel} (« ${pire.texte} ») — élément clé`);
      }
    }
  }

  // Régressions dues au thème.
  for (const theme of ['theme-2', 'theme-3', 'theme-4', 'theme-5', 'theme-1 darkOverride', 'theme-5 darkOverride']) {
    let regressions = 0;
    for (const [cle, m] of Object.entries(parTheme[theme])) {
      const ref = parTheme['theme-1'][cle];
      if (!ref || ref.ratio < ref.seuil) continue;   // deja bas en theme clair : style du jeu
      if (m.ratio >= m.seuil) continue;
      regressions++;
      if (regressions <= 4) fail(`${theme} : « ${m.texte} » (${m.ou}) passe de ${ref.ratio} à ${m.ratio} [${m.couleurs}] (ref: ${ref.couleurs})`);
    }
    console.log(`  ${theme} : ${regressions} texte(s) lisibles en clair et illisibles ici`);
  }

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
