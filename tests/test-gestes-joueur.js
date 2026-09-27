// Les gestes du joueur qu'aucun autre test n'exerçait (relevé par la couverture, voir couverture.js) :
//  1. premier lancement : le choix de la langue, retenu au rechargement ;
//  2. modes d'achat x10 et MAX : prix affiché, quantité achetée, jamais à crédit ;
//  3. export puis import de la partie, par le code copié et par le fichier, comme le joueur le fait
//     pour changer d'appareil ; un code invalide ne casse rien ;
//  4. bouton « Restaurer » d'une sauvegarde de secours ;
//  5. chat du jardin (cadeau horaire du Spécial), curseur de volume, clic un peu à côté du bouton
//     désigné par le tutoriel ;
//  6. l'appli native, simulée (window.__TAURI__) : fichier d'export, sauvegarde quotidienne,
//     presse-papiers, lien du signalement de bug (et son repli sans le plugin), proposition de
//     mise à jour au lancement puis installation, bouton Quitter.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const { filePath, chargerPartie } = require('./commun');
let problems = 0;
const ok = (c, m, detail) => { console.log((c ? '  ok ' : '  X  ') + m + (!c && detail ? ' : ' + detail : '')); if (!c) problems++; };

// Une page du jeu. `etat` : partie préparée (sinon premier lancement). `tauri` : options du faux
// window.__TAURI__ (sinon version web).
async function demarrer(b, { etat, tauri } = {}) {
  const p = await b.newPage({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });
  p.erreurs = [];
  p.on('pageerror', e => p.erreurs.push(e.message));
  p.on('dialog', d => d.accept());
  if (tauri) await p.addInitScript((opt) => {
    const journal = window.__journalTauri = [];
    const note = (quoi, ...x) => { journal.push([quoi, ...x]); };
    window.__TAURI__ = {
      window: { getCurrentWindow: () => ({ onCloseRequested: () => {}, close: async () => note('fermer'), destroy: async () => note('fermer') }) },
      fs: { BaseDirectory: { AppData: 'AppData' }, writeTextFile: async (chemin, texte) => note('fichier', chemin, texte) },
      dialog: { save: async () => 'C:/Joueur/fuzz-save.txt' },
      clipboardManager: { writeText: async (t) => note('presse', t) },
      app: { getVersion: async () => '0.8.0' },
      process: { relaunch: async () => note('relance') },
      updater: { check: async () => opt.maj ? { available: true, version: '9.9.9', downloadAndInstall: async (cb) => { note('installer'); if (cb) { cb({ event: 'Started', data: { contentLength: 100 } }); cb({ event: 'Progress', data: { chunkLength: 100 } }); cb({ event: 'Finished' }); } } } : null },
    };
    if (opt.opener) window.__TAURI__.opener = { openUrl: async (u) => note('lien', u) };
  }, tauri);
  await p.goto(filePath);
  // Une mise à jour proposée retient le démarrage : c'est justement ce que le test observe.
  if (etat) await chargerPartie(p, etat, { attendre: !(tauri && tauri.maj) });
  return p;
}
const pret = (p) => p.waitForFunction(() => document.getElementById('splashOverlay').style.display === 'none'
  && !document.getElementById('updatePromptOverlay').classList.contains('open'), { timeout: 20000 });
const PARTIE = { verdure: 1e6, totalClicks: 5000, totalPlayTimeSec: 7200, prestigeCount: 4, cosmicSeeds: 7, buildings: { stagiaire: 12, voisin: 5 } };

(async () => {
  const b = await chromium.launch();

  console.log('=== 1. premier lancement : choix de la langue ===');
  let p = await demarrer(b);
  await p.waitForFunction(() => document.getElementById('langPopupOverlay').style.display === 'flex', { timeout: 20000 });
  await p.waitForTimeout(400);
  await p.click('#langPopupEn');
  await p.waitForTimeout(1500);
  const langue = await p.evaluate(() => ({ lang: state.lang, choisie: state.langChosen, scene: document.getElementById('sceneOverlay').classList.contains('visible'),
    popup: document.getElementById('langPopupOverlay').style.display, magasin: document.querySelector('#shopPageOverlay h2, #shopPageOverlay .shopTitle')?.textContent || '' }));
  ok(langue.lang === 'en' && langue.choisie, 'la langue choisie est appliquée', JSON.stringify(langue));
  ok(langue.scene, 'la scène d\'ouverture suit le choix de la langue');
  await p.reload();
  await p.waitForTimeout(2500);
  const relance = await p.evaluate(() => ({ lang: state.lang, popup: document.getElementById('langPopupOverlay').style.display }));
  ok(relance.lang === 'en' && relance.popup !== 'flex', 'retenue au rechargement, sans reposer la question', JSON.stringify(relance));
  ok(!p.erreurs.length, 'aucune erreur JavaScript', p.erreurs.join(' | '));
  await p.close();

  console.log('=== 2. modes d\'achat x10 et MAX ===');
  p = await demarrer(b, { etat: PARTIE });
  await pret(p);
  const modes = await p.evaluate(() => {
    hideDialogue(false); openModal('shopPageOverlay'); activeShopTab = 'production'; renderAll();
    const b = BUILDINGS[0], r = {};
    const mode = (m) => { [...document.querySelectorAll('.buyModeBtn')].find(x => x._mode === m).click(); renderAll(); };
    const ligne = () => document.querySelector(`#shop [data-row-id="${b.id}"]`);
    // x10 : le prix de dix, et dix achetés.
    mode(10);
    const prix10 = buildingCost(b, 10);
    state.verdure = prix10; renderAll();
    r.affiche10 = ligne().querySelector('.price').textContent.includes(formatNum(prix10));
    const avant = state.buildings[b.id];
    ligne().click();
    r.achetes10 = state.buildings[b.id] - avant; r.reste10 = state.verdure;
    // MAX : autant que la Verdure en permet, pas un de plus.
    mode('max');
    state.verdure = buildingCost(b, 7) * 1.0001; renderAll();
    r.afficheMax = ligne().querySelector('.price').textContent;
    const avantMax = state.buildings[b.id];
    ligne().click();
    r.achetesMax = state.buildings[b.id] - avantMax; r.resteMax = state.verdure; r.prixSuivant = buildingCost(b, 1);
    mode(1);
    return r;
  });
  ok(modes.affiche10 && modes.achetes10 === 10 && Math.abs(modes.reste10) < 1e-6, 'x10 : prix de dix affiché, dix achetés pour ce prix', JSON.stringify(modes));
  ok(/x7\b/.test(modes.afficheMax) && modes.achetesMax === 7 && modes.resteMax >= 0 && modes.resteMax < modes.prixSuivant, 'MAX : « x7 » affiché, sept achetés, jamais à crédit', JSON.stringify(modes));
  ok(!p.erreurs.length, 'aucune erreur JavaScript', p.erreurs.join(' | '));
  await p.close();

  console.log('=== 3. export puis import (version web) ===');
  p = await demarrer(b, { etat: PARTIE });
  await pret(p);
  await p.evaluate(() => { window.__copie = null; navigator.clipboard.writeText = async (t) => { window.__copie = t; }; hideDialogue(false); openModal('settingsModalOverlay'); renderAll(); });
  await p.click('#copyCodeBtn');
  await p.waitForTimeout(300);
  const code = await p.evaluate(() => window.__copie);
  const exporte = code && JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
  ok(exporte && exporte.prestigeCount === 4 && exporte.buildings.stagiaire === 12, 'le code copié contient la partie');
  const [telechargement] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
  const contenu = fs.readFileSync(await telechargement.path(), 'utf8');
  ok(/^fuzz-save-\d{4}-\d{2}-\d{2}\.txt$/.test(telechargement.suggestedFilename()) && contenu === code, 'le fichier exporté porte la date et contient le même code', telechargement.suggestedFilename());
  // Import d'un code invalide : message, et la partie reste là.
  await p.evaluate(() => { window.prompt = () => 'pas un code'; window.__alerte = null; window.alert = (m) => { window.__alerte = m; }; });
  await p.click('#importPasteBtn');
  const invalide = await p.evaluate(() => ({ alerte: window.__alerte, prestiges: state.prestigeCount }));
  ok(/invalide/i.test(invalide.alerte || '') && invalide.prestiges === 4, 'un code invalide est refusé sans rien casser', JSON.stringify(invalide));
  // Le vrai geste : une autre partie, puis on colle le code exporté.
  await p.evaluate((code) => { state.prestigeCount = 0; state.buildings = {}; window.prompt = () => code; }, code);
  await Promise.all([p.waitForEvent('load'), p.click('#importPasteBtn')]);
  await pret(p);
  const importe = await p.evaluate(() => ({ prestiges: state.prestigeCount, stagiaires: state.buildings.stagiaire, miseDeCote: !!localStorage.getItem(SAVE_KEY_AVANT_IMPORT) }));
  ok(importe.prestiges === 4 && importe.stagiaires >= 12 && importe.miseDeCote, 'le code importé restaure la partie, l\'ancienne est mise de côté', JSON.stringify(importe));
  // Import par fichier.
  await p.evaluate(() => { state.prestigeCount = 1; });
  await Promise.all([p.waitForEvent('load'), p.setInputFiles('#importFileInput', { name: 'fuzz-save.txt', mimeType: 'text/plain', buffer: Buffer.from(code) })]);
  await pret(p);
  ok(await p.evaluate(() => state.prestigeCount) === 4, 'le fichier importé restaure la partie');
  ok(!p.erreurs.length, 'aucune erreur JavaScript', p.erreurs.join(' | '));
  await p.close();

  console.log('=== 4. bouton « Restaurer » d\'une sauvegarde de secours ===');
  p = await demarrer(b, { etat: PARTIE });
  await pret(p);
  await p.evaluate(() => {
    localStorage.setItem(SAVE_KEY_BACKUP, JSON.stringify({ ...state, prestigeCount: 9, totalEarned: 123456 }));
    hideDialogue(false); openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    document.getElementById('restoreBackupBtn').click(); renderAll();
  });
  await Promise.all([p.waitForEvent('load'), p.click('#backupList [data-backup="auto"]')]);
  await pret(p);
  ok(await p.evaluate(() => state.prestigeCount) === 9, 'la sauvegarde choisie est restaurée');
  await p.close();

  console.log('=== 5. chat du jardin, volume, clic à côté du bouton désigné ===');
  p = await demarrer(b, { etat: { ...PARTIE, uniqueBuildings: { chatJardin: true } } });
  await pret(p);
  const divers = await p.evaluate(() => {
    hideDialogue(false);
    const r = {};
    const avant = state.verdure, attendu = bonusChatJardin(totalCps());
    bonusHoraireChat();
    r.chat = state.verdure - avant; r.attendu = attendu;
    r.toast = [...document.querySelectorAll('.toast')].some(t => /🐈/.test(t.textContent));
    state.uniqueBuildings = {}; const sans = state.verdure; bonusHoraireChat(); r.sansChat = state.verdure - sans;
    openModal('settingsModalOverlay'); activeSettingsTab = 'options'; renderAll();
    const curseur = document.getElementById('volumeSlider');
    curseur.value = 30; curseur.dispatchEvent(new Event('input')); curseur.dispatchEvent(new Event('change'));
    r.volume = state.soundVolume; r.libelle = document.getElementById('volumeValueLabel').textContent;
    closeModal('settingsModalOverlay');
    return r;
  });
  ok(Math.abs(divers.chat - divers.attendu) < 1e-6 && divers.toast && divers.sansChat === 0, 'le chat rapporte son cadeau (et rien sans lui)', JSON.stringify(divers));
  ok(divers.volume === 30 && /30/.test(divers.libelle), 'le curseur de volume règle le son', JSON.stringify(divers));
  const demarrageArme = fs.readFileSync(path.resolve(__dirname, '../dist/jeu/demarrage.js'), 'utf8').includes('bonusHoraireChat');
  ok(demarrageArme, 'le cadeau du chat est armé au démarrage (demarrage.js)');
  // Tutoriel : un clic sur l'écran assombri, à quelques pixels du bouton désigné, compte comme un clic dessus.
  await p.evaluate(() => { window.__clique = false; showTutorialSpotlight(document.getElementById('settingsBtn'), () => { window.__clique = true; }); });
  const cible = await p.evaluate(() => { const r = document.getElementById('settingsBtn').getBoundingClientRect(); return { x: r.left - 10, y: r.top + r.height / 2 }; });
  await p.mouse.click(cible.x, cible.y);
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__clique), 'un clic à 10 px du bouton désigné le déclenche');
  ok(!p.erreurs.length, 'aucune erreur JavaScript', p.erreurs.join(' | '));
  await p.close();

  console.log('=== 6. appli native (window.__TAURI__ simulé) ===');
  p = await demarrer(b, { etat: PARTIE, tauri: { opener: true } });
  await pret(p);
  const natif = await p.evaluate(async () => {
    hideDialogue(false);
    _dernierFichierAuto = null; await sauvegardeFichierQuotidienne(JSON.stringify(state));
    openModal('settingsModalOverlay'); renderAll();
    document.getElementById('exportBtn').click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('bugReportBtn').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('bugReportOpenBtn').click();
    await new Promise(r => setTimeout(r, 300));
    return { journal: window.__journalTauri, carte: document.getElementById('updateCard').style.display, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent) };
  });
  const quoi = (q) => natif.journal.filter(e => e[0] === q);
  const auto = quoi('fichier').find(e => e[1] === 'fuzz-sauvegarde-auto.txt');
  const exportNatif = quoi('fichier').find(e => e[1] === 'C:/Joueur/fuzz-save.txt');
  ok(!!auto, 'la sauvegarde quotidienne s\'écrit dans un fichier');
  ok(exportNatif && JSON.parse(Buffer.from(exportNatif[2], 'base64').toString('utf8')).prestigeCount === 4, 'export : le fichier choisi reçoit la partie');
  ok(quoi('presse').length >= 1 && natif.toasts.some(t => t.includes('C:/Joueur/fuzz-save.txt')), 'export : code aussi copié, et le joueur voit où est le fichier', natif.toasts.join(' | '));
  ok(quoi('lien').some(e => /github\.com\/.+\/issues\/new/.test(e[1])), 'signalement : le lien GitHub s\'ouvre par le plugin', JSON.stringify(quoi('lien')));
  ok(natif.carte === 'flex', 'la carte de mise à jour est visible dans les Options');
  // Quitter : Papi dit au revoir, puis la fenêtre se ferme.
  await p.evaluate(() => { closeModal('settingsModalOverlay'); document.getElementById('quitGameBtn').click(); });
  await p.waitForFunction(() => window.__journalTauri.some(e => e[0] === 'fermer'), { timeout: 15000 }).catch(() => {});
  ok(await p.evaluate(() => window.__journalTauri.some(e => e[0] === 'fermer')), 'Quitter ferme la fenêtre');
  ok(!p.erreurs.length, 'aucune erreur JavaScript', p.erreurs.join(' | '));
  await p.close();

  // Sans le plugin « opener » (ancienne appli installée) : l'adresse part dans le presse-papiers.
  p = await demarrer(b, { etat: PARTIE, tauri: {} });
  await pret(p);
  const repli = await p.evaluate(async () => {
    hideDialogue(false); openModal('settingsModalOverlay'); renderAll();
    document.getElementById('bugReportBtn').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('bugReportOpenBtn').click();
    await new Promise(r => setTimeout(r, 300));
    return { presse: window.__journalTauri.filter(e => e[0] === 'presse').map(e => e[1]), toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent) };
  });
  ok(repli.presse.some(u => /github\.com/.test(u)) && repli.toasts.some(t => /copi/i.test(t)), 'sans le plugin, l\'adresse est copiée et le joueur prévenu', JSON.stringify(repli));
  await p.close();

  // Mise à jour disponible au lancement : proposée, puis installée et l'appli relancée.
  p = await demarrer(b, { etat: PARTIE, tauri: { maj: true } });
  await p.waitForFunction(() => document.getElementById('updatePromptOverlay').classList.contains('open'), { timeout: 20000 }).catch(() => {});
  const proposee = await p.evaluate(() => ({ ouverte: document.getElementById('updatePromptOverlay').classList.contains('open'), texte: document.getElementById('updatePromptBody').textContent }));
  ok(proposee.ouverte && /9\.9\.9/.test(proposee.texte), 'la mise à jour est proposée au lancement', JSON.stringify(proposee));
  await p.click('#updatePromptInstallBtn');
  await p.waitForFunction(() => window.__journalTauri.some(e => e[0] === 'relance'), { timeout: 10000 }).catch(() => {});
  const installee = await p.evaluate(() => window.__journalTauri.map(e => e[0]));
  ok(installee.includes('installer') && installee.includes('relance'), 'installer télécharge la mise à jour puis relance l\'appli', installee.join(','));
  ok(!p.erreurs.length, 'aucune erreur JavaScript', p.erreurs.join(' | '));
  await p.close();

  console.log(problems ? `\n${problems} PROBLEME(S)` : '\nTOUT EST OK');
  await b.close();
  process.exitCode = problems ? 1 : 0;
})();
