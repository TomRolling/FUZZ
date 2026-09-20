// ================= COSMÉTIQUES DE CLIC =================
function hasSkin(id) { return !!state.ownedSkins[id]; }
function activeSkinEmojis() {
  const sk = SKINS.find(x => x.id === state.activeSkin) || SKINS[0];
  return sk.emojis;
}
function buySkin(id) {
  const sk = SKINS.find(x => x.id === id);
  if (!sk || hasSkin(id)) return;
  if (state.cosmicSeeds < sk.cost) return;
  state.cosmicSeeds -= sk.cost;
  state.ownedSkins[id] = true;
  finaliserAchat({ onglet: 'clic' }); // les cosmétiques vivent dans l'onglet Clic
  showToast(state.lang === 'en' ? `🎨 Cosmetic unlocked: ${L(sk,'name')}` : `🎨 Cosmétique débloqué : ${L(sk,'name')}`);
}
function selectSkin(id) {
  if (!hasSkin(id) || state.activeSkin === id) return;
  state.activeSkin = id;
  saveGame(); renderAll();
}

// ================= SOUND (procédural, sans fichier externe) =================
let _audioCtx = null;
function ensureAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(()=>{});
  return _audioCtx;
}
// ================= MUSIQUE DE FOND =================
// Plusieurs pistes d'ambiance possibles : à chaque lancement puis à chaque fin de piste,
// une piste est repiochée au hasard dans AMBIENT_TRACKS (jamais deux fois la même à la
// suite), plutôt qu'une seule piste qui boucle indéfiniment sur elle-même.
// Fondu à l'entrée (premier démarrage / changement de piste) et à la sortie (dès que le
// son est coupé). Suit le même interrupteur et le même volume que les effets sonores.
const AMBIENT_TRACKS = [
  'night_theme',
  'a_beautiful_day_picking_weeds_with_a_terrible_grandpa',
  'the_grass_isnt_greener_elsewhere',
];
let _currentAmbientTrack = null;
function pickRandomAmbientTrack(excludeCurrent) {
  const pool = (excludeCurrent && AMBIENT_TRACKS.length > 1)
    ? AMBIENT_TRACKS.filter(t => t !== _currentAmbientTrack)
    : AMBIENT_TRACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}
function loadAmbientTrack(name) {
  const audio = document.getElementById('bgMusic');
  if (!audio) return;
  _currentAmbientTrack = name;
  // MP3 en PREMIER, .m4a seulement en repli : nos .m4a sont exportés avec le brand QuickTime
  // (`major_brand: qt`) et certains moteurs — dont la WebView du bureau — refusent de les
  // décoder. Le navigateur prend la première <source> qu'il déclare savoir lire ; en mettant
  // le format universel devant, on ne dépend plus d'un décodage AAC qui peut échouer sans
  // jamais basculer sur le repli (le repli ne joue qu'à l'échec du *chargement*, pas du décodage).
  audio.innerHTML = `<source src="assets/audio/${name}.mp3" type="audio/mpeg">` +
    `<source src="assets/audio/${name}.m4a" type="audio/mp4">`;
  audio.load();
}
let _musicStarted = false;
let _musicStartPending = false;
let _musicFadeInterval = null;
function fadeAudioTo(audioEl, targetVolume, durationMs) {
  clearInterval(_musicFadeInterval);
  const steps = 30;
  const stepTime = Math.max(16, durationMs / steps);
  const startVolume = audioEl.volume;
  const delta = (targetVolume - startVolume) / steps;
  let count = 0;
  _musicFadeInterval = setInterval(() => {
    count++;
    const next = startVolume + delta * count;
    audioEl.volume = Math.max(0, Math.min(1, next));
    if (count >= steps) {
      clearInterval(_musicFadeInterval);
      audioEl.volume = Math.max(0, Math.min(1, targetVolume));
      if (targetVolume <= 0) audioEl.pause();
    }
  }, stepTime);
}
function musicTargetVolume() {
  if (!state.soundEnabled) return 0;
  const vol = (state.soundVolume === undefined ? 100 : state.soundVolume) / 100;
  return vol * 0.16; // nettement en retrait des effets sonores (0.32 était trop fort de base)
}
function switchToNewAmbientTrack(excludeCurrent, fadeMs) {
  const audio = document.getElementById('bgMusic');
  loadAmbientTrack(pickRandomAmbientTrack(excludeCurrent));
  audio.volume = 0;
  const attempt = audio.play();
  fadeAudioTo(audio, musicTargetVolume(), fadeMs);
  return Promise.resolve(attempt); // les vieux moteurs renvoient undefined au lieu d'une promesse
}
function startBackgroundMusic() {
  const audio = document.getElementById('bgMusic');
  if (!audio || _musicStarted || _musicStartPending) return;
  if (!state.soundEnabled) return; // respecte une préférence déjà désactivée, ne joue rien
  // On ne verrouille `_musicStarted` qu'une fois la lecture RÉELLEMENT acceptée : si ce
  // geste-ci n'a pas suffi (politique d'autoplay, piste illisible), les écouteurs restent
  // armés et le geste suivant retentera, au lieu de condamner la musique pour de bon.
  _musicStartPending = true;
  switchToNewAmbientTrack(false, 2500).then(
    () => { _musicStarted = true; disarmMusicGestures(); },
    () => { clearInterval(_musicFadeInterval); audio.pause(); }
  ).then(() => { _musicStartPending = false; });
}
// Dès qu'une piste se termine, on en repioche une autre au hasard (jamais deux fois de
// suite la même s'il y en a plusieurs) plutôt que de boucler sur elle-même.
document.getElementById('bgMusic').addEventListener('ended', () => {
  if (!state.soundEnabled) return;
  switchToNewAmbientTrack(true, 1500).catch(() => {});
});
// Une piste illisible (codec refusé, fichier absent) ne doit pas tuer la musique : on passe
// à une autre. `_ambientErrorStreak` évite la boucle infinie si AUCUNE piste ne se charge.
let _ambientErrorStreak = 0;
document.getElementById('bgMusic').addEventListener('error', () => {
  if (!state.soundEnabled) return;
  if (++_ambientErrorStreak > AMBIENT_TRACKS.length) return;
  switchToNewAmbientTrack(true, 1500).catch(() => {});
}, true);
document.getElementById('bgMusic').addEventListener('playing', () => { _ambientErrorStreak = 0; });
function updateMusicVolume() {
  const audio = document.getElementById('bgMusic');
  if (!audio) return;
  // Réactiver le son alors que la musique n'a jamais réussi à démarrer (son coupé au
  // lancement, ou premier essai refusé) : le réglage lui-même sert de geste utilisateur.
  if (!_musicStarted) { beginBackgroundMusic(); return; }
  if (state.soundEnabled && (audio.paused || audio.ended)) {
    if (audio.ended || !_currentAmbientTrack) loadAmbientTrack(pickRandomAmbientTrack(true));
    audio.play().catch(() => {});
  }
  fadeAudioTo(audio, musicTargetVolume(), 700);
}
// Démarrage de la musique. On ESSAIE IMMÉDIATEMENT plutôt que d'attendre un geste : dans la
// fenêtre de bureau (WebView2) la lecture est autorisée sans interaction, et c'est justement
// cette attente d'un geste qui laissait le jeu totalement muet — la musique n'était jamais ne
// serait-ce que tentée. Les navigateurs, eux, refusent l'autoplay : le play() est alors rejeté,
// `_musicStarted` reste faux, et les écouteurs ci-dessous prennent le relais au premier geste.
// Ils sont en phase de CAPTURE (un overlay qui ferait stopPropagation ne peut pas les
// court-circuiter) et restent armés tant que la lecture n'a pas réellement démarré : chaque
// nouveau geste retente, au lieu de n'avoir qu'une seule chance.
const MUSIC_GESTURES = ['pointerdown', 'click', 'touchstart', 'keydown'];
function armMusicGestures() {
  if (_musicStarted || !state.soundEnabled) return;
  MUSIC_GESTURES.forEach(ev => document.addEventListener(ev, startBackgroundMusic, { capture: true, passive: true }));
}
function disarmMusicGestures() {
  MUSIC_GESTURES.forEach(ev => document.removeEventListener(ev, startBackgroundMusic, true));
}
// Appelée quand le JEU commence vraiment (voir runOpeningIfNeeded), et surtout PAS au
// chargement du script : les écrans de démarrage (logo du studio, puis logo du jeu) doivent
// rester silencieux — la musique entre avec la scène de Papi et Leroy.
function beginBackgroundMusic() {
  armMusicGestures();
  startBackgroundMusic(); // réussit sur le bureau, rejetée sans dégât là où l'autoplay est bloqué
}

function playTone(freq, duration = 0.08, type = 'sine', vol = 0.04) {
  if (!state.soundEnabled) return;
  const volume = (state.soundVolume === undefined ? 100 : state.soundVolume) / 100;
  if (volume <= 0) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.value = vol * volume;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}
function playClickSound() { playTone(560 + Math.random() * 90, 0.05, 'sine', 0.025); }
function playBuySound() { playTone(320, 0.1, 'triangle', 0.045); }
// Première fois qu'un compagnon / une amélioration de clic est révélé(e) : petit motif à deux
// notes, franc et court. Distinct du jingle des objets rares (playRareItemSound, plus long).
// Volume nettement au-dessus des autres effets : c'est un événement rare (la toute première
// acquisition d'un objet) et il passait inaperçu par-dessus la musique.
function playFirstPurchaseSound() {
  playTone(523, 0.09, 'triangle', 0.13);
  setTimeout(() => playTone(784, 0.18, 'triangle', 0.15), 95);
}
function playAchievementSound() { playTone(520, 0.09, 'sine', 0.05); setTimeout(() => playTone(760, 0.14, 'sine', 0.05), 90); }
function playPrestigeSound() { playTone(220, 0.15, 'sawtooth', 0.04); setTimeout(() => playTone(440, 0.2, 'sine', 0.05), 120); setTimeout(() => playTone(660, 0.25, 'sine', 0.04), 260); }
function playGoldenSound() { playTone(700, 0.06, 'sine', 0.05); setTimeout(() => playTone(900, 0.1, 'sine', 0.05), 70); }
// Première acquisition d'un objet à achat unique (Spécial / Bâtiments) : petit arpège
// ascendant qui se termine sur une note tenue — volontairement plus long et plus "posé" que
// le son de succès (2 notes) pour que l'oreille distingue tout de suite les deux événements.
function playRareItemSound() {
  playTone(392, 0.10, 'triangle', 0.045);
  setTimeout(() => playTone(523, 0.10, 'triangle', 0.045), 110);
  setTimeout(() => playTone(659, 0.12, 'triangle', 0.05), 220);
  setTimeout(() => playTone(784, 0.30, 'sine', 0.055), 350);
}

