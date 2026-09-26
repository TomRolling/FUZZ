cd "$(dirname "$0")"
ok=0; ko=""
for t in check-tables scan-traduction test-signalement test-agencement test-confort-fenetres test-nouveau-joueur test-doigt-onglets test-onglets-simultanes test-achats-papi test-contraste test-format-nombres test-papi-visite test-hud-succes test-saisons test-confort test-sauvegardes test-traduction test-web test-hors-ligne test-presentations test-annuler-import test-fluidite test-import verif-capacites test-papi-auto test-tout-debloquer mesure-bulles test-reset-total test-capacites-ecran test-save-roundtrip test-familiers test-mode-test test-resize-lisibilite test-defis test-automatisation test-auto-presentation test-paliers test-equilibre-ui test-onboarding test-ui-tuto test-onglets test-descriptifs test-tuto-halo test-bugs test-divers test-survol test-bonus test-scale test-shopbtn test-music3 test-parcours-onglets test-mystere test-bonus-jour test-full-reset-scenarios audit-chevauchements test-ceremonie fuzz-tuto; do
  if node $t.js > "sortie-$t.txt" 2>&1; then ok=$((ok+1)); else ko="$ko $t"; fi
done
echo "OK: $ok  ECHECS:${ko:- aucun}"
