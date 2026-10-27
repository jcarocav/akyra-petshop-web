// Accesibilidad (WCAG 2.2 AA): axe-core sin violaciones en todas las páginas y estados.
import AxeBuilder from '@axe-core/playwright'
import { elegirProducto, expect, test } from './ayuda.mjs'

async function sinViolaciones(page, nombre) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  const detalle = r.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('\n   ')}`).join('\n')
  expect(r.violations, `${nombre}:\n${detalle}`).toEqual([])
}

const PAGINAS = [
  ['inicio', '/index.html?tema=ninguno'],
  ['inicio con tema Halloween', '/index.html?tema=halloween'],
  ['inicio con tema Fiestas Patrias (portada)', '/index.html?tema=fiestas-patrias'],
  ['inicio con Día del Animal', '/index.html?tema=dia-animal'],
  ['catálogo', '/catalogo.html'],
  ['catálogo granel', '/catalogo.html?categoria=granel'],
  ['catálogo con filtros', '/catalogo.html?categoria=gatos&tipo=Alimento%20h%C3%BAmedo&marca=Felix'],
  ['catálogo sin resultados', '/catalogo.html?buscar=zzzzzz'],
  ['contacto', '/contactenos.html'],
  ['política de privacidad', '/politica-privacidad.html'],
  ['política de despacho', '/politica-despacho-retiro.html'],
  ['política de cambios', '/politica-cambios-devoluciones.html'],
  ['declaración de accesibilidad', '/accesibilidad.html'],
  ['404', '/404.html']
]

for (const [nombre, ruta] of PAGINAS) {
  test(`axe: ${nombre}`, async ({ page }) => {
    await page.goto(ruta)
    await page.waitForLoadState('networkidle')
    await sinViolaciones(page, nombre)
  })
}

test.describe('con el aviso de privacidad', () => {
  test.use({ conPrivacidad: true })
  test('axe: aviso de privacidad abierto, foco dentro y Esc lo cierra', async ({ page }) => {
    await page.goto('/index.html')
    const aviso = page.getByRole('dialog', { name: 'Antes de seguir…' })
    await expect(aviso).toBeVisible()
    await expect(page.locator('#aviso-privacidad-aceptar')).toBeFocused()
    await sinViolaciones(page, 'aviso de privacidad')
    await page.keyboard.press('Escape')
    await expect(aviso).toBeHidden()
  })
})

test('axe: ficha de producto, con tallas y agotada', async ({ page }) => {
  await page.goto('/catalogo.html')
  const simple = await elegirProducto(page, 'simple-mucho-stock')
  const tallas = await elegirProducto(page, 'tallas')
  await page.goto(`/producto.html?id=${simple.id}`)
  await expect(page.locator('#ficha')).toBeVisible()
  await sinViolaciones(page, 'ficha')
  await page.goto(`/producto.html?id=${tallas.id}`)
  await page.locator('#ficha .talla').first().click()
  await sinViolaciones(page, 'ficha con talla elegida')
  await page.goto('/producto.html?id=no-existe')
  await sinViolaciones(page, 'producto no encontrado')
})

test('axe: carrito en sus 2 pasos, con errores y confirmación', async ({ page, context }) => {
  await page.goto('/catalogo.html')
  const a = await elegirProducto(page, 'simple-mucho-stock')
  await page.evaluate(a => localStorage.setItem('akyra_carrito_v2', JSON.stringify([{ id: a.id, talla: null, cantidad: 2 }])), a)
  await page.reload()
  await page.locator('#boton-carrito').click()
  await expect(page.locator('#carrito')).toBeVisible()
  await sinViolaciones(page, 'carrito paso 1')
  await page.getByRole('button', { name: 'Continuar compra' }).click()
  await sinViolaciones(page, 'carrito paso 2')
  await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click()
  await expect(page.locator('#pedido-errores')).toBeVisible()
  await sinViolaciones(page, 'carrito paso 2 con errores')
  await page.getByLabel('Nombre *').fill('Prueba')
  await page.getByLabel('Teléfono *').fill('912345678')
  await page.getByLabel('Sucursal de retiro *').selectOption('hornillas')
  await page.locator('label[for="pago-2"]').click()
  await expect(page.locator('#pago-2')).toBeChecked()
  const nueva = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click()
  await nueva
  await expect(page.locator('#carrito-paso-3')).toBeVisible()
  await sinViolaciones(page, 'confirmación')
})

test('axe: filtros del catálogo abiertos en celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/catalogo.html?categoria=perros')
  await page.locator('#filtros-abrir').click()
  await expect(page.locator('#filtros')).toHaveAttribute('role', 'dialog')
  await sinViolaciones(page, 'filtros en celular')
  await page.keyboard.press('Escape')
  await expect(page.locator('#filtros-abrir')).toBeFocused()
})

test('teclado: "Saltar al contenido" es lo primero y lleva al contenido', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari no enfoca enlaces con Tab por defecto')
  await page.goto('/catalogo.html')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#contenido$/)
})

test('movimiento reducido: el carrusel queda en pausa', async ({ browser }) => {
  const contexto = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await contexto.newPage()
  await page.addInitScript(() => localStorage.setItem('akyra_privacidad_aceptada', 'true'))
  await page.goto('http://localhost:4173/index.html')
  await expect(page.locator('#hero-pausa')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.cinta').first()).toHaveClass(/cinta--pausada/)
  await contexto.close()
})

test('zoom al 200 %: sin scroll horizontal', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Simula un computador de 1280 px al 200 %; en celular no aplica')
  await page.setViewportSize({ width: 640, height: 900 }) // 1280 px de ancho al 200 %
  for (const ruta of ['/index.html', '/catalogo.html', '/contactenos.html']) {
    await page.goto(ruta)
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(ancho, ruta).toBeLessThanOrEqual(1)
  }
})

test('botones − y + de al menos 44×44 px', async ({ page }) => {
  await page.goto('/catalogo.html?categoria=gatos')
  const caja = await page.locator('.cantidad__boton').first().boundingBox()
  expect(caja.width).toBeGreaterThanOrEqual(43.5) // 44 px CSS (WebKit informa 43,99…)
  expect(caja.height).toBeGreaterThanOrEqual(43.5)
})
