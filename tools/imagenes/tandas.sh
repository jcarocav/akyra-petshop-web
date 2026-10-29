#!/bin/bash
# Busca fotos en tandas de 100 productos y hace commit al terminar cada tanda (retoma donde quedó).
cd "$(dirname "$0")/../.."
for i in 1 2 3 4 5 6 7 8; do
  node tools/imagenes/buscar-web.mjs --max 100 || { echo "tanda $i cortada (código $?)"; break; }
  git add -A assets/productos tools/catalogo/fotos-progreso.json
  git commit -q -m "Fotos: tanda $i de búsqueda en la web (avance guardado en fotos-progreso.json)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git push -q origin fotos-faltantes
  echo "tanda $i lista"
done
echo FIN
