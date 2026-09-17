// Verifie : (1) chaque piste de AMBIENT_TRACKS se charge et se lit vraiment,
// (2) un premier play() refuse ne condamne pas la musique — le geste suivant retente,
// (3) une piste illisible fait basculer sur une autre au lieu de tuer la musique.
const { chromium } = require('playwright');
const path = require('path');
const filePath = 'file://' + path.resolve(__dirname, '../dist/index.html').split(path.sep).join('/');

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.errs = errs;
  await page.goto(filePath);
  await page.evaluate(() => { state.langChosen = true; state.tutorialSeen = true; saveGame(); });
  await page.reload();
  await page.waitForTimeout(1000);
  return page;
}

(async () => {
  const browser = await chromium.launch();
  let problems = 0;
  const fail = (...m) => { console.log('  X', ...m); problems++; };

  // --- 1. chaque piste joue reellement ---
  {
    const page = await boot(browser);
    const tracks = await page.evaluate(() => AMBIENT_TRACKS);
    console.log('AMBIENT_TRACKS =', tracks);
    if (tracks.length !== 3) fail('3 pistes attendues, trouve', tracks.length);
    await page.mouse.click(640, 410); // debloque l'autoplay
    await page.waitForTimeout(500);
    for (const t of tracks) {
      const r = await page.evaluate(async (name) => {
        const a = document.getElementById('bgMusic');
        loadAmbientTrack(name);
        a.volume = 0.1;
        try { await a.play(); } catch (e) { return { name, err: e.name }; }
        await new Promise(res => setTimeout(res, 900));
        return { name, src: a.currentSrc.split('/').pop(), paused: a.paused, t: +a.currentTime.toFixed(2), readyState: a.readyState, err: a.error ? a.error.code : null };
      }, t);
      console.log('  piste:', JSON.stringify(r));
      if (r.err || r.paused || !(r.t > 0)) fail('piste injouable:', t);
    }
    if (page.errs.length) fail('erreurs page:', page.errs);
    await page.close();
  }

  // --- 2. premier play() refuse -> retente au geste suivant ---
  {
    const page = await boot(browser);
    // Tout refuser tant que _blockPlay est vrai, pour simuler une phase ou l'autoplay est
    // bloque, puis lever le blocage et verifier qu'un geste ULTERIEUR relance bien.
    await page.evaluate(() => {
      window._blockPlay = true;
      const a = document.getElementById('bgMusic');
      const orig = a.play.bind(a);
      a.play = function () {
        if (window._blockPlay) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
        return orig();
      };
    });
    await page.mouse.click(640, 410);
    await page.waitForTimeout(600);
    const after1 = await page.evaluate(() => _musicStarted);
    console.log('  pendant le blocage, _musicStarted =', after1, '(attendu: false)');
    if (after1 !== false) fail('_musicStarted verrouille alors que la lecture a echoue');
    await page.evaluate(() => { window._blockPlay = false; });
    await page.mouse.click(640, 410);
    await page.waitForTimeout(1500);
    const after2 = await page.evaluate(() => ({ started: _musicStarted, paused: document.getElementById('bgMusic').paused }));
    console.log('  apres 2e geste, ', JSON.stringify(after2), '(attendu: started=true, paused=false)');
    if (!after2.started || after2.paused) fail('pas de nouvelle tentative au geste suivant');
    await page.close();
  }

  // --- 3. piste illisible -> bascule sur une autre ---
  {
    const page = await boot(browser);
    await page.mouse.click(640, 410);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
      const a = document.getElementById('bgMusic');
      const before = _currentAmbientTrack;
      a.innerHTML = '<source src="assets/audio/piste_inexistante.mp3" type="audio/mpeg">';
      a.load();
      try { await a.play(); } catch (e) {}
      await new Promise(res => setTimeout(res, 2500));
      return { before, apres: _currentAmbientTrack, paused: a.paused, t: +a.currentTime.toFixed(2), err: a.error ? a.error.code : null };
    });
    console.log('  ', JSON.stringify(r));
    if (r.paused || !(r.t > 0)) fail('une piste illisible laisse la musique morte');
    await page.close();
  }

  console.log(problems === 0 ? '\nTOUT EST OK' : `\n${problems} PROBLEME(S)`);
  await browser.close();
  process.exitCode = problems ? 1 : 0;
})();
