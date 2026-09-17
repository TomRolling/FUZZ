f=$1
grep -E "###|Ascensions :" $f | cut -c1-300
grep -E "^\s+(production|clic|batiments|special|recherche|prestige|ascension) +[0-9]+/" $f | grep jamais | cut -c1-200
grep -A3 "Temps morts" $f | tail -1 | cut -c1-200
grep -E "^\s+\[" $f | awk 'NR%4==0' | tail -8
grep "Ordre de premiere" -A8 $f | grep -o "tortueGalaxies@[0-9.]*\|lucioleEtoiles@[0-9.]*\|grenouilleTrouNoir@[0-9.]*\|hibouFinDesTemps@[0-9.]*\|dragonMousse@[0-9.]*\|espritMareInfinie@[0-9.]*\|r_prod1[123]@[0-9.]*\|r_cheap[67]@[0-9.]*\|as_prod[456]@[0-9.]*\|as_cheaper2@[0-9.]*\|c3[12]@[0-9.]*\|sourceToutesMares@[0-9.]*" | tr '\n' ' '; echo
