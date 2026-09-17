// Nouvel equilibrage : les textes affiches correspondent aux valeurs, les formules se comportent
// comme prevu, et une ancienne sauvegarde avec des Eclats est migree sans perte.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');
let problems = 0;
const fail = (...m) => { console.log('  X', ...m); problems++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', e => fail('pageerror:', e.message));
  await page.goto(filePath);

  console.log('=== 1. descriptions coherentes avec les valeurs ===');
  const incoherences = await page.evaluate(() => {
    const out = [];
    const pctTxt = v => String(+(v * 100).toFixed(4));
    for (const c of CLICK_UPGRADES) {
      if (c.type === 'cpsPercent' && !c.desc.fr.includes(pctTxt(c.value) + '%')) out.push(`${c.id} (${c.value}) : ${c.desc.fr}`);
      if (c.type === 'totalMult' && !c.desc.fr.includes('+' + Math.round((c.value - 1) * 100) + '%')) out.push(`${c.id} : ${c.desc.fr}`);
      if (c.type === 'flatMult' && !c.desc.fr.includes(Math.round((c.value - 1) * 100) + '%')) out.push(`${c.id} : ${c.desc.fr}`);
    }
    for (const u of [...PRESTIGE_UPGRADES, ...ASCENSION_UPGRADES]) {
      if (u.type === 'clickMult' && !u.desc.fr.includes('+' + Math.round((u.value - 1) * 100) + '%')) out.push(`${u.id} : ${u.desc.fr}`);
      if (u.type === 'clickCpsPercent' && !u.desc.fr.includes(pctTxt(u.value) + '%')) out.push(`${u.id} : ${u.desc.fr}`);
      if (u.type === 'startBonus' && !u.desc.fr.includes(u.value + ' min')) out.push(`${u.id} : ${u.desc.fr}`);
    }
    for (const u of UNIQUE_BUILDINGS) if (u.active) {
      const a = u.active;
      if (a.value && !u.desc.fr.includes('x' + a.value + ' ')) out.push(`${u.id} valeur : ${u.desc.fr}`);
      if (!u.desc.fr.includes(`recharge ${a.cooldownMs / 60000} min`)) out.push(`${u.id} recharge : ${u.desc.fr}`);
    }
    return out;
  });
  console.log('  incoherences :', incoherences.length ? incoherences : 'aucune');
  if (incoherences.length) fail('descriptions qui ne correspondent pas aux valeurs');

  console.log('=== 2. formules ===');
  const f = await page.evaluate(() => {
    state.seedsSinceAscension = 100; state.cosmicSeeds = 3; state.totalShardsEarned = 4; state.stellarShards = 0;
    const r = { graines100: seedMultiplier(), eclats4: shardMultiplier() };
    state.buildings = {}; state.clickUpgrades = {}; state.prestigeUpgrades = {}; state.ascensionUpgrades = {};
    comboCount = 0;
    r.clicNu = clickGain();
    state.clickUpgrades = { c1: true, c2: true };
    state.buildings = { stagiaire: 100 };
    r.clicAvecC1C2 = clickGain(); r.cps = totalCps();
    r.seuil1Graine = PRESTIGE_DIVISOR; r.diviseurAscension = ASCENSION_SEED_DIVISOR;
    return r;
  });
  console.log('  ', JSON.stringify(f));
  if (Math.abs(f.graines100 - 2) > 1e-9) fail('100 Graines gagnees doivent donner x2 (1 + 0,1 x racine(100))');
  if (Math.abs(f.eclats4 - 3) > 1e-9) fail('4 Eclats gagnes doivent donner x3');
  if (Math.abs(f.clicNu - 1) > 1e-9) fail('le clic de base doit valoir 1, sans multiplicateur de production');
  if (Math.abs(f.clicAvecC1C2 - (2 + f.cps * 0.001)) > 1e-6) fail('clic avec c1 + c2 attendu 2 + 0,1 % de la production');

  console.log('=== 3. migration d une ancienne sauvegarde ===');
  await page.evaluate(() => {
    const vieux = { ...state, stellarShards: 2, ascensionUpgrades: { as_prod1: true, as_seedBoost1: true }, totalAscensions: 1, saveVersion: 2 };
    delete vieux.totalShardsEarned;
    window.saveGame = () => {}; // sinon la sauvegarde de beforeunload ecrase la fausse ancienne sauvegarde
    localStorage.setItem(SAVE_KEY, JSON.stringify(vieux));
  });
  await page.reload();
  const mig = await page.evaluate(() => ({ solde: state.stellarShards, gagnes: state.totalShardsEarned, attendu: 2 + ASCENSION_UPGRADES.find(u => u.id === 'as_prod1').cost + ASCENSION_UPGRADES.find(u => u.id === 'as_seedBoost1').cost }));
  console.log('  ', JSON.stringify(mig));
  if (mig.gagnes !== mig.attendu) fail('Eclats gagnes mal reconstitues');

  console.log('=== 4. textes du Prestige et de l Ascension ===');
  const txt = await page.evaluate(() => {
    state.langChosen = true; state.tutorialSeen = true; state.verdure = 5e11; state.seedsSinceAscension = 25; state.totalSeedsEarned = 25;
    for (const t of TAB_DEFS) { state.tabsSeen[t.id] = true; state.tabsDescribed[t.id] = true; }
    renderPrestige(); renderAscension();
    return { prestige: document.getElementById('prestigeInfo').textContent, ascension: document.getElementById('ascensionInfo').textContent };
  });
  console.log('  Prestige  :', txt.prestige.slice(0, 260));
  console.log('  Ascension :', txt.ascension.slice(0, 260));
  if (/1\.15/.test(txt.prestige) || /x1\.5 par /.test(txt.ascension)) fail('ancien texte de formule encore affiche');
  if (!/\+50 %/.test(txt.prestige + txt.ascension) && !/graines gagnées/.test(txt.prestige)) fail('nouveau texte absent');

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
