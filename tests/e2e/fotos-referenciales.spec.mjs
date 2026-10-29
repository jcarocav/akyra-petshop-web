// Fotos referenciales: llevan solo un aviso discreto debajo de la imagen (sin botón de WhatsApp propio);
// las exactas no muestran el aviso.
import AxeBuilder from '@axe-core/playwright'
import { abrirCard, catalogo, conDatos, expect, test } from './ayuda.mjs'

const BASE = { marca: 'Genérico', categoria: 'accesorios', subcategoria: 'Platos y bebederos', precio: 3000, imagen: 'assets/productos/ACC-AMER-001.webp' }
const REFERENCIAL = { ...BASE, id: 'zzz-ref-001', sku: 'ZZZ-REF-001', nombre: 'Plato Plástico De Prueba Referencial', imagenTipo: 'referencial' }
const EXACTA = { ...BASE, id: 'zzz-exa-001', sku: 'ZZZ-EXA-001', nombre: 'Plato Plástico De Prueba Exacto', imagenTipo: 'exacta' }
const STOCK = { 'ZZZ-REF-001': 5, 'ZZZ-EXA-001': 5 }
const AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

test('la card referencial muestra el aviso corto debajo de la foto, sin botón extra ni etiqueta sobre la foto; la exacta no', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL, EXACTA], stockExtra: STOCK })
  const cardRef = await abrirCard(page, REFERENCIAL)
  const aviso = cardRef.locator('.nota-referencial')
  await expect(aviso).toHaveText('Imagen referencial')
  await expect(cardRef.locator('img.producto-foto')).toHaveAttribute('alt', /\(imagen referencial\)$/)
  // debajo de la foto (no encima): el aviso empieza donde termina la imagen
  const foto = await cardRef.locator('a.tarjeta__media').boundingBox()
  const nota = await aviso.boundingBox()
  expect(nota.y).toBeGreaterThanOrEqual(foto.y + foto.height - 1)
  // sin etiqueta superpuesta ni botones de WhatsApp: la card solo tiene "Añadir"
  await expect(cardRef.locator('.etiqueta-referencial')).toHaveCount(0)
  await expect(cardRef.locator('a[href*="wa.me"], button:has-text("WhatsApp")')).toHaveCount(0)
  // no tapa el precio ni el botón Añadir
  for (const otro of [cardRef.locator('.precio'), cardRef.getByRole('button', { name: /^Añadir/ })]) {
    const caja = await otro.first().boundingBox()
    const separados = nota.y + nota.height <= caja.y + 1 || caja.y + caja.height <= nota.y + 1 || nota.x + nota.width <= caja.x || caja.x + caja.width <= nota.x
    expect(separados).toBe(true)
  }
  const cardExa = await abrirCard(page, EXACTA)
  await expect(cardExa.locator('.nota-referencial')).toHaveCount(0)
  await expect(cardExa.locator('img.producto-foto')).not.toHaveAttribute('alt', /referencial/)
})

test('la ficha referencial trae solo el aviso bajo la foto, sin botón de WhatsApp; la exacta no', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL, EXACTA], stockExtra: STOCK })
  await page.goto(`/producto.html?id=${REFERENCIAL.id}`)
  await expect(page.locator('#ficha')).toBeVisible()
  const aviso = page.locator('#ficha .ficha__galeria .nota-referencial')
  await expect(aviso).toHaveText('Imagen referencial. Consulta por WhatsApp para ver el producto real en tienda.')
  const foto = await page.locator('#ficha-media').boundingBox()
  expect((await aviso.boundingBox()).y).toBeGreaterThanOrEqual(foto.y + foto.height - 1)
  await expect(page.locator('#ficha-media img')).toHaveAttribute('alt', /\(imagen referencial\)$/)
  await expect(page.locator('#ficha .etiqueta-referencial')).toHaveCount(0)
  // ningún botón o enlace propio de WhatsApp por la imagen referencial (los del encabezado y el flotante no son de la ficha)
  await expect(page.locator('#ficha a[href*="wa.me"]:visible')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Ver foto real/ })).toHaveCount(0)
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  const r = await new AxeBuilder({ page }).withTags(AXE).analyze()
  expect(r.violations.map(v => v.id)).toEqual([])
  await page.goto(`/producto.html?id=${EXACTA.id}`)
  await expect(page.locator('#ficha')).toBeVisible()
  await expect(page.locator('#ficha .ficha__galeria .nota-referencial')).toHaveCount(0)
})

test('el aviso es gris pequeño con contraste AA y se lee en celular', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL], stockExtra: STOCK })
  const card = await abrirCard(page, REFERENCIAL)
  const { color, fondo, tam } = await card.locator('.nota-referencial').evaluate(e => {
    const c = getComputedStyle(e)
    let f = e
    while (f && getComputedStyle(f).backgroundColor === 'rgba(0, 0, 0, 0)') f = f.parentElement
    return { color: c.color, fondo: getComputedStyle(f).backgroundColor, tam: parseFloat(c.fontSize) }
  })
  const luz = rgb => {
    const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [a, b] = [luz(color), luz(fondo)].sort((x, y) => y - x)
  expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5)
  expect(tam).toBeGreaterThanOrEqual(11.5) // chico pero legible
})

test('las cards con foto exacta y referencial en la misma fila tienen la misma altura y alineación', async ({ page, isMobile }) => {
  test.skip(isMobile, 'En celular las cards son horizontales, una por fila')
  await conDatos(page, { productosExtra: [REFERENCIAL, EXACTA], stockExtra: STOCK })
  await page.goto('/catalogo.html?buscar=Plato%20Pl%C3%A1stico%20De%20Prueba')
  const a = page.locator(`article.tarjeta[data-producto="${REFERENCIAL.id}"]`)
  const b = page.locator(`article.tarjeta[data-producto="${EXACTA.id}"]`)
  await expect(a).toBeVisible()
  await expect(b).toBeVisible()
  const [ca, cb] = [await a.boundingBox(), await b.boundingBox()]
  expect(Math.abs(ca.height - cb.height)).toBeLessThanOrEqual(1)
  const [na, nb] = [await a.locator('.tarjeta__nombre').boundingBox(), await b.locator('.tarjeta__nombre').boundingBox()]
  expect(Math.abs((na.y - ca.y) - (nb.y - cb.y))).toBeLessThanOrEqual(1) // el nombre empieza a la misma altura
})

test('en el catálogo real, cada foto declara su tipo y el aviso solo aparece en las referenciales', async ({ page }) => {
  await page.goto('/catalogo.html')
  const datos = await catalogo(page)
  const conFoto = datos.productos.filter(p => p.imagen)
  expect(conFoto.length).toBeGreaterThan(0)
  for (const p of conFoto) expect(['exacta', 'referencial'], p.sku).toContain(p.imagenTipo)
  expect(datos.productos.filter(p => !p.imagen && p.imagenTipo).map(p => p.sku)).toEqual([])
  await expect(page.locator('article.tarjeta').first()).toBeVisible()
  const malas = await page.evaluate(() => [...document.querySelectorAll('article.tarjeta')].filter(t => {
    const p = window.AKYRA_CATALOGO.productos.find(x => x.id === t.dataset.producto)
    return !!t.querySelector('.nota-referencial') !== (p?.imagenTipo === 'referencial')
  }).length)
  expect(malas).toBe(0)
})

test('axe: card referencial en el catálogo', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL], stockExtra: STOCK })
  await abrirCard(page, REFERENCIAL)
  const r = await new AxeBuilder({ page }).withTags(AXE).analyze()
  expect(r.violations.map(v => v.id)).toEqual([])
})
