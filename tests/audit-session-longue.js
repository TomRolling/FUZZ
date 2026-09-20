// Audit de longue session : un jeu incremental reste ouvert des heures. On enchaine des rounds
// de jeu intensif (clics, achats, menus, evenements, bulles de Papi, temps qui passe) et on
// mesure apres chacun, memoire nettoyee : taille du tas JS, nombre d'elements de la page,
// ecouteurs d'evenements, minuteurs actifs. Une fuite se voit comme une serie qui monte round
// apres round sans jamais se stabiliser.
const { chromium } = require('playwright'); const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
const ROUNDS = parseInt(process.argv[2] || '15', 10);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
  p.on('pageerror', e => console.log('  pageerror:', e.message));
  // Compte des minuteurs reellement actifs (setInterval jamais arretes, setTimeout en attente).
  await p.addInitScript(() => {
    const actifs = new Set();
    const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, ct = window.clearTimeout;
    window.setInterval = function (...a) { const id = si.apply(this, a); actifs.add('i' + id); return id; };
    window.clearInterval = function (id) { actifs.delete('i' + id); return ci.call(this, id); };
    window.setTimeout = function (f, ...a) { let id; const g = typeof f === 'function' ? function (...x) { actifs.delete('t' + id); return f.apply(this, x); } : f; id = st.call(this, g, ...a); actifs.add('t' + id); return id; };
    window.clearTimeout = function (id) { actifs.delete('t' + id); return ct.call(this, id); };
    window.__minuteurs = () => ({ intervalles: [...actifs].filter(x => x[0] === 'i').length, attentes: [...actifs].filter(x => x[0] === 't').length });
  });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Performance.enable');

  await p.goto(filePath);
  await p.evaluate(() => {
    window.saveGame = () => {};
    const st = { ...state, langChosen: true, tutorialSeen: true, lastDailyLoginDate: todayStr(),
      verdure: 1e15, knowledge: 5000, cosmicSeeds: 40, prestigeCount: 7, totalAscensions: 2, stellarShards: 5,
      totalClicks: 5000, totalPlayTimeSec: 3e5 };
    for (const t of TAB_DEFS) { st.tabsSeen[t.id] = true; st.tabsDescribed[t.id] = true; }
    st.buildings = Object.fromEntries(BUILDINGS.slice(0, 16).map((x, i) => [x.id, 100 - i * 5]));
    st.uniqueBuildings = Object.fromEntries(UNIQUE_BUILDINGS.slice(0, 4).map(u => [u.id, true]));
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  });
  await p.reload();
  await p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none', { timeout: 15000 });
  await p.waitForTimeout(2500);

  const mesure = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await p.waitForTimeout(200);
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
    const t = await p.evaluate(() => window.__minuteurs());
    return { tasMo: +(m.JSHeapUsedSize / 1048576).toFixed(2), elements: m.Nodes, ecouteurs: m.JSEventListeners, ...t };
  };

  // Un round : quelques minutes de jeu intense, tout ce qu'un joueur fait en boucle.
  const round = () => p.evaluate(async () => {
    const pause = (ms) => new Promise(r => setTimeout(r, ms));
    hideDialogue(false);
    for (let i = 0; i < 150; i++) document.getElementById('clickZone').click();
    for (let i = 0; i < 20; i++) buyBuilding(BUILDINGS[i % 12].id, 1);
    for (const u of CLICK_UPGRADES.slice(0, 3)) buyClickUpgrade(u.id);
    for (const [ov, var_, onglets] of [['shopPageOverlay', 'activeShopTab', ['production', 'clic', 'batiments', 'special', 'recherche', 'prestige']],
                                      ['questsModalOverlay', 'activeQuestsTab', ['quetes', 'dailyreward', 'defi']],
                                      ['settingsModalOverlay', 'activeSettingsTab', ['options', 'stats', 'galerie']]]) {
      openModal(ov);
      for (const o of onglets) { window[var_] = o; renderAll(); await pause(20); }
      closeModal(ov); await pause(200);
    }
    openModal('achievementsModalOverlay'); await pause(50); closeModal('achievementsModalOverlay'); await pause(200);
    spawnGoldenWeed(); const g = document.querySelector('.golden'); if (g) g.click();
    spawnButterflies(); const pap = document.querySelector('.golden'); if (pap) pap.click();
    for (let i = 0; i < 8; i++) showToast('rafale ' + i);
    papiSaysFromCategory('randomUnrelated'); await pause(300); hideDialogue(false);
    showItemPopup({ title: 'x', name: 'x', desc: 'x' }); await pause(50); document.getElementById('itemPopupCloseBtn').click();
    avancerTemps(600); // dix minutes de jeu : meteo, quetes, minuteurs...
    await pause(900);   // laisse retomber particules, notifications et fondus
  });

  const series = [await mesure()];
  console.log('  round  tas(Mo)  elements  ecouteurs  intervalles  attentes');
  const ligne = (i, m) => console.log(`  ${String(i).padStart(5)}  ${String(m.tasMo).padStart(7)}  ${String(m.elements).padStart(8)}  ${String(m.ecouteurs).padStart(9)}  ${String(m.intervalles).padStart(11)}  ${String(m.attentes).padStart(8)}`);
  ligne(0, series[0]);
  for (let i = 1; i <= ROUNDS; i++) {
    await round();
    series.push(await mesure());
    ligne(i, series[i]);
  }

  // Verdict : on compare la seconde moitie a la premiere. Une croissance reguliere est suspecte ;
  // une valeur qui plafonne apres les premiers rounds (caches, reservoirs) est normale.
  const moitie = Math.floor(series.length / 2);
  const moyenne = (arr, k) => arr.reduce((s, x) => s + x[k], 0) / arr.length;
  console.log('\n  Evolution entre la 1re et la 2e moitie de la session :');
  for (const k of ['tasMo', 'elements', 'ecouteurs', 'intervalles', 'attentes']) {
    const a = moyenne(series.slice(1, moitie), k), z = moyenne(series.slice(moitie), k);
    const pente = (series[series.length - 1][k] - series[moitie][k]) / Math.max(1, series.length - 1 - moitie);
    console.log(`  ${k.padEnd(12)} ${a.toFixed(1).padStart(8)} -> ${z.toFixed(1).padStart(8)}   (pente en fin de session : ${pente >= 0 ? '+' : ''}${pente.toFixed(2)} par round)`);
  }
  await b.close();
})();
