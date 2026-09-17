f=$1
grep -E "###|Ascensions :" $f | cut -c1-260
grep -E "^\s+(production|clic|batiments|special|recherche|prestige|ascension) +[0-9]+/" $f | grep jamais | cut -c1-160
grep "Part du revenu" -A300 $f | grep -E "^\s+(1|3|5|8|10|13|15|18|20|23)\.00 j→ production [0-9]+%" | cut -c1-110
grep "Ordre de premiere" -A8 $f | grep -o "jardinHorsTemps@[0-9.]*\|tortueGalaxies@[0-9.]*\|espritMareInfinie@[0-9.]*\|r_prod13@[0-9.]*\|as_prod6@[0-9.]*" | tr '\n' ' '; echo
