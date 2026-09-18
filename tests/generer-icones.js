// Regenere les icones web (dist/icons/) a partir du logo du jeu (dist/assets/logo.png).
// Redimensionnement au plus proche voisin : c'est du pixel art, un lissage le rendrait flou.
// Les variantes « maskable » et apple-touch recoivent un fond (iOS et Android remplissent le
// reste en noir sinon) et une marge de securite, leurs bords etant rognes par le systeme.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
// En data URI : une image file:// chargee depuis une page vierge est bloquee par le navigateur.
const logo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../dist/assets/logo.png')).toString('base64');
const sortie = path.resolve(__dirname, '../dist/icons');
const FOND = '#cdebc6'; // le vert clair du jeu, celui du manifeste

const CIBLES = [
  { nom: 'favicon.png', taille: 64, fond: null, marge: 0 },
  { nom: 'favicon-32.png', taille: 32, fond: null, marge: 0 },
  { nom: 'icon-192.png', taille: 192, fond: null, marge: 0 },
  { nom: 'icon-512.png', taille: 512, fond: null, marge: 0 },
  { nom: 'icon-192-maskable.png', taille: 192, fond: FOND, marge: 0.16 },
  { nom: 'icon-512-maskable.png', taille: 512, fond: FOND, marge: 0.16 },
  { nom: 'apple-touch-icon.png', taille: 180, fond: FOND, marge: 0.08 },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(`<img id="logo" src="${logo}">`);
  await p.waitForFunction(() => { const i = document.getElementById('logo'); return i.complete && i.naturalWidth > 0; });

  // Bords transparents du logo : les garder reviendrait a dessiner du vide, ce qui se paie cher
  // sur un favicon de 32 px.
  const cadre = await p.evaluate(() => {
    const img = document.getElementById('logo');
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  });
  console.log('  logo utile :', `${cadre.w}x${cadre.h}`, 'a partir de', `${cadre.x},${cadre.y}`);

  for (const c of CIBLES) {
    const data = await p.evaluate(({ taille, fond, marge, cadre }) => {
      const img = document.getElementById('logo');
      const cv = document.createElement('canvas');
      cv.width = cv.height = taille;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      if (fond) { ctx.fillStyle = fond; ctx.fillRect(0, 0, taille, taille); }
      // Le logo est plus large que haut : on le pose entier, centre, sans le deformer.
      const dispo = taille * (1 - 2 * marge);
      const ratio = Math.min(dispo / cadre.w, dispo / cadre.h);
      const w = Math.round(cadre.w * ratio), h = Math.round(cadre.h * ratio);
      ctx.drawImage(img, cadre.x, cadre.y, cadre.w, cadre.h,
                   Math.round((taille - w) / 2), Math.round((taille - h) / 2), w, h);
      return cv.toDataURL('image/png').split(',')[1];
    }, { ...c, cadre });
    fs.writeFileSync(path.join(sortie, c.nom), Buffer.from(data, 'base64'));
    console.log('  ecrit :', c.nom, `(${c.taille}px)`);
  }
  await b.close();
  console.log('icones regenerees depuis assets/logo.png');
})();
