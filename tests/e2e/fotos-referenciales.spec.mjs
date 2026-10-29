// Fotos referenciales: llevan etiqueta "Imagen referencial", aviso y botón de WhatsApp; las exactas, no.
import AxeBuilder from '@axe-core/playwright'
import { abrirCard, catalogo, conDatos, expect, test } from './ayuda.mjs'

const BASE = { marca: 'Genérico', categoria: 'accesorios', subcategoria: 'Platos y bebederos', precio: 3000, imagen: 'assets/productos/ACC-AMER-001.webp' }
const REFERENCIAL = { ...BASE, id: 'zzz-ref-001', sku: 'ZZZ-REF-001', nombre: 'Plato Plástico De Prueba Referencial', imagenTipo: 'referencial' }
const EXACTA = { ...BASE, id: 'zzz-exa-001', sku: 'ZZZ-EXA-001', nombre: 'Plato Plástico De Prueba Exacto', imagenTipo: 'exacta' }
const STOCK = { 'ZZZ-REF-001': 5, 'ZZZ-EXA-001': 5 }

test('la card de una foto referencial muestra "Imagen referencial" y el alt lo dice; la exacta no', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL, EXACTA], stockExtra: STOCK })
  const cardRef = await abrirCard(page, REFERENCIAL)
  await expect(cardRef.locator('.etiqueta-referencial')).toHaveText('Imagen referencial')
  await expect(cardRef.locator('img.producto-foto')).toHaveAttribute('alt', /\(imagen referencial\)$/)
  // no tapa el precio ni el botón Añadir
  const etiqueta = await cardRef.locator('.etiqueta-referencial').boundingBox()
  for (const otro of [cardRef.locator('.precio'), cardRef.getByRole('button', { name: /^Añadir/ })]) {
    const caja = await otro.first().boundingBox()
    const separados = etiqueta.y + etiqueta.height <= caja.y || caja.y + caja.height <= etiqueta.y || etiqueta.x + etiqueta.width <= caja.x || caja.x + caja.width <= etiqueta.x
    expect(separados).toBe(true)
  }
  const cardExa = await abrirCard(page, EXACTA)
  await expect(cardExa.locator('.etiqueta-referencial')).toHaveCount(0)
  await expect(cardExa.locator('img.producto-foto')).not.toHaveAttribute('alt', /referencial/)
})

test('la ficha referencial trae el aviso y el botón "Ver foto real por WhatsApp"; la exacta no', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL, EXACTA], stockExtra: STOCK })
  await page.goto(`/producto.html?id=${REFERENCIAL.id}`)
  const aviso = page.locator('#ficha-referencial')
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('La imagen es de referencia. Consúltanos por WhatsApp para ver el producto real en tienda.')
  await expect(page.locator('#ficha-media .etiqueta-referencial')).toHaveText('Imagen referencial')
  const boton = page.getByRole('link', { name: /Ver foto real por WhatsApp/ })
  const url = new URL(await boton.getAttribute('href'))
  expect(url.hostname).toBe('wa.me')
  expect(url.pathname).toBe('/56986969111')
  expect(url.searchParams.get('text')).toBe('Hola, ¿me pueden mandar una foto real de Plato Plástico De Prueba Referencial (SKU ZZZ-REF-001)?')
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  expect(r.violations.map(v => v.id)).toEqual([])
  await page.goto(`/producto.html?id=${EXACTA.id}`)
  await expect(page.locator('#ficha')).toBeVisible()
  await expect(page.locator('#ficha-referencial')).toBeHidden()
  await expect(page.locator('#ficha-media .etiqueta-referencial')).toHaveCount(0)
})

test('en el catálogo real, cada foto declara su tipo y las cards cuadran: etiqueta solo en las referenciales', async ({ page }) => {
  await page.goto('/catalogo.html')
  const datos = await catalogo(page)
  const conFoto = datos.productos.filter(p => p.imagen)
  expect(conFoto.length).toBeGreaterThan(0)
  for (const p of conFoto) expect(['exacta', 'referencial'], p.sku).toContain(p.imagenTipo)
  expect(datos.productos.filter(p => !p.imagen && p.imagenTipo).map(p => p.sku)).toEqual([])
  await expect(page.locator('article.tarjeta').first()).toBeVisible()
  const malas = await page.evaluate(() => [...document.querySelectorAll('article.tarjeta')].filter(t => {
    const p = window.AKYRA_CATALOGO.productos.find(x => x.id === t.dataset.producto)
    return !!t.querySelector('.etiqueta-referencial') !== (p?.imagenTipo === 'referencial')
  }).length)
  expect(malas).toBe(0)
})

test('axe: card referencial en el catálogo', async ({ page }) => {
  await conDatos(page, { productosExtra: [REFERENCIAL], stockExtra: STOCK })
  await abrirCard(page, REFERENCIAL)
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  expect(r.violations.map(v => v.id)).toEqual([])
})
