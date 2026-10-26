# Maskotería Akyra — sitio web

Tienda de mascotas en Punta Arenas (Casa Matriz, Hornillas y Las Lengas). Sitio estático en HTML, CSS y
JavaScript puro, publicado en GitHub Pages: https://jcarocav.github.io/akyra-petshop-web/

- **Catálogo con stock real**: `productos.json` (catálogo) + `stock.json` (unidades por SKU), generados desde el
  Excel de inventario (`npm run catalogo`) y actualizados cada hora desde la planilla "Akyra · Stock web"
  (GitHub Action `stock.yml`).
- **Carrito → pedido por WhatsApp** (+56 9 8696 9111, en `config.js`): cantidades, tallas, granel por kilo,
  despacho o retiro, método de pago. El cliente aprieta "Enviar" en WhatsApp.
- **Accesible (WCAG 2.2 AA)**, seguro (CSP estricta, sin scripts externos) y liviano (fuentes, íconos y fotos locales).

## Para el día a día
- **Ver el sitio en tu computador**: doble clic en `VER-SITIO.bat` (carpeta de arriba).
- **Catálogo desde un Excel nuevo**: deja el `Inventario_*.xlsx` en la carpeta de arriba y doble clic en
  `ACTUALIZAR-CATALOGO.bat`. Revisa el sitio y publica (commit a la rama, y merge a `main` cuando esté aprobado).
- **Stock diario**: automático (ver `CLAUDE.md` → "Actualización diaria del stock"). Si algo falla, revisa la hoja
  "Historial" de la planilla y la pestaña **Actions** del repositorio.

## Para desarrollar
```bash
npm ci
npx playwright install
npm run verificar
```

Detalle de reglas, comandos y estructura: [`CLAUDE.md`](CLAUDE.md).
