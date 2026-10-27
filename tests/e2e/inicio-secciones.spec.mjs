// Inicio: navbar animado, sucursales (mapas y fachadas), Instagram (Elfsight) y carrusel de marcas con logos.
import { expect, test } from './ayuda.mjs'

const TRANSFORM_CERO = 'matrix(0, 0, 0, 1, 0, 0)'
const TRANSFORM_UNO = 'matrix(1, 0, 0, 1, 0, 0)'
const subrayado = enlace => enlace.evaluate(e => getComputedStyle(e, '::after').transform)

test.describe('navbar y botón "Ver todo el catálogo"', () => {
  test.skip(({ isMobile }) => isMobile, 'El menú horizontal es de escritorio')
  // (WebKit de escritorio puede informar menos de 1100 px de ancho real: ahí el menú es el de celular)
  const soloMenuHorizontal = async page => test.skip(await page.evaluate(() => innerWidth) < 1100, 'Menú de celular')

  test('el botón no toca los bordes de la barra y mide al menos 24×24', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await soloMenuHorizontal(page)
    const menu = await page.locator('.menu').boundingBox()
    const boton = await page.locator('.menu__destacado a').boundingBox()
    expect(boton.y - menu.y).toBeGreaterThanOrEqual(8)
    expect(menu.y + menu.height - (boton.y + boton.height)).toBeGreaterThanOrEqual(8)
    expect(boton.height).toBeGreaterThanOrEqual(24)
    expect(boton.width).toBeGreaterThanOrEqual(24)
    // En proporción con las pestañas: no más alto que ellas
    const pestana = await page.locator('.menu__lista li:first-child a').boundingBox()
    expect(boton.height).toBeLessThanOrEqual(pestana.height)
  })

  test('hover y foco: el subrayado entra en 180–250 ms sin mover el menú, y el botón no queda blanco sobre amarillo', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await soloMenuHorizontal(page)
    const enlace = page.locator('.menu__lista li:nth-child(2) a')
    const antes = await page.locator('.menu__lista').boundingBox()
    const caja = await enlace.boundingBox()
    const duracion = await enlace.evaluate(e => getComputedStyle(e, '::after').transitionDuration)
    const ms = parseFloat(duracion) * (duracion.endsWith('ms') ? 1 : 1000)
    expect(ms).toBeGreaterThanOrEqual(180)
    expect(ms).toBeLessThanOrEqual(250)
    expect(await subrayado(enlace)).toBe(TRANSFORM_CERO)
    await enlace.hover()
    await expect.poll(() => subrayado(enlace)).toBe(TRANSFORM_UNO)
    expect(await enlace.boundingBox()).toEqual(caja)
    expect(await page.locator('.menu__lista').boundingBox()).toEqual(antes)
    // foco de teclado: igual
    await page.mouse.move(0, 400)
    const tercero = page.locator('.menu__lista li:nth-child(3) a')
    await tercero.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect.poll(() => subrayado(tercero)).toBe(TRANSFORM_UNO)
    // el botón destacado en hover: texto oscuro sobre amarillo
    const destacado = page.locator('.menu__destacado a')
    await destacado.hover()
    await expect.poll(() => destacado.evaluate(e => getComputedStyle(e).color)).toBe('rgb(35, 31, 32)')
    expect(await destacado.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe('rgb(255, 255, 255)')
  })

  test('con movimiento reducido no hay animación', async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 800 } })
    const page = await contexto.newPage()
    await page.addInitScript(() => localStorage.setItem('akyra_privacidad_aceptada', 'true'))
    await page.goto('http://localhost:4173/index.html?tema=ninguno')
    const duracion = await page.locator('.menu__lista li:nth-child(2) a').evaluate(e => getComputedStyle(e, '::after').transitionDuration)
    expect(parseFloat(duracion)).toBeLessThan(0.05)
    await contexto.close()
  })
})

test.describe('sucursales', () => {
  test('los mapas no cargan con el inicio: cargan al acercarse la sección, con título y espacio reservado', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.mapa__iframe')).toHaveCount(0)
    const altoAntes = await page.locator('.mapa').first().evaluate(e => e.getBoundingClientRect().height)
    expect(altoAntes).toBeGreaterThanOrEqual(200) // reservado
    await page.locator('#sucursales').scrollIntoViewIfNeeded()
    await expect(page.locator('.mapa__iframe')).toHaveCount(3)
    await expect(page.locator('.mapa__iframe').nth(1)).toHaveAttribute('title', 'Mapa de la sucursal Hornillas, Hornillas 080')
    await expect(page.locator('.mapa__iframe').first()).toHaveAttribute('loading', 'lazy')
    expect(await page.locator('.mapa').first().evaluate(e => e.getBoundingClientRect().height)).toBe(altoAntes)
    await expect(page.getByRole('button', { name: /Ver mapa/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Cómo llegar/ })).toHaveCount(3)
  })

  test('las fachadas cambian cada 3 s y la tarjeta se resalta; pausa con botón y con mouse', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/index.html?tema=ninguno')
    await page.locator('#sucursales').scrollIntoViewIfNeeded()
    const resaltada = () => page.locator('.sucursal--resaltada').getAttribute('data-sucursal')
    const fotos = page.locator('.fachada')
    for (let i = 0; i < 3; i++) await expect(fotos.nth(i)).toHaveAttribute('alt', /\S{8}/)
    await expect.poll(resaltada).toBe('casa-matriz')
    await expect(page.locator('.fachada--activa')).toHaveAttribute('data-sucursal', 'casa-matriz')
    await expect.poll(resaltada, { timeout: 8000 }).toBe('hornillas') // cambia a los 3 s
    await expect(page.locator('.fachada--activa')).toHaveAttribute('data-sucursal', 'hornillas')
    await expect(page.locator('.sucursal--resaltada .sucursal__etiqueta')).toHaveText('Foto de fondo') // no depende solo del color
    // pausa con el botón
    await page.getByRole('button', { name: 'Pausar el cambio de fotos de fondo' }).click()
    await expect(page.getByRole('button', { name: 'Reanudar el cambio de fotos de fondo' })).toHaveAttribute('aria-pressed', 'true')
    const congelada = await resaltada()
    await page.waitForTimeout(4000)
    expect(await resaltada()).toBe(congelada)
    // reanuda: vuelve a cambiar
    await page.getByRole('button', { name: 'Reanudar el cambio de fotos de fondo' }).click()
    // (mientras el mouse o el foco estén dentro de la sección sigue en pausa: se salen)
    await page.mouse.move(0, 0)
    await page.evaluate(() => document.activeElement.blur())
    await expect.poll(resaltada, { timeout: 8000 }).not.toBe(congelada)
  })

  test('las fachadas se detienen mientras el mouse está sobre la sección', async ({ page, isMobile }) => {
    test.skip(isMobile, 'El mouse no existe en celular')
    test.setTimeout(60_000)
    await page.goto('/index.html?tema=ninguno')
    await page.locator('#sucursales').scrollIntoViewIfNeeded()
    await page.locator('.sucursales__lista').hover()
    const resaltada = () => page.locator('.sucursal--resaltada').getAttribute('data-sucursal')
    const inicial = await resaltada()
    await page.waitForTimeout(4500)
    expect(await resaltada()).toBe(inicial)
  })

  test('con movimiento reducido: primera foto fija y resplandor sin animación', async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
    const page = await contexto.newPage()
    await page.addInitScript(() => localStorage.setItem('akyra_privacidad_aceptada', 'true'))
    await page.clock.install()
    await page.goto('http://localhost:4173/index.html?tema=ninguno')
    await page.locator('#sucursales').scrollIntoViewIfNeeded()
    await page.clock.runFor(9000)
    expect(await page.locator('.sucursal--resaltada').getAttribute('data-sucursal')).toBe('casa-matriz')
    await expect(page.locator('.fachadas__pausa')).toHaveAttribute('aria-pressed', 'true')
    expect(parseFloat(await page.locator('.sucursal').first().evaluate(e => getComputedStyle(e).transitionDuration))).toBeLessThan(0.05)
    await contexto.close()
  })
})

test.describe('Instagram (Elfsight)', () => {
  test('va justo debajo de "Alimento a granel", con título y contenedor', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    expect(await page.locator('#alimento-granel').evaluate(e => e.nextElementSibling.id)).toBe('instagram')
    await expect(page.getByRole('heading', { level: 2, name: 'Síguenos en Instagram' })).toBeVisible()
    await expect(page.locator('.elfsight-app-4cc8cd0a-2a8e-4e1f-bd6b-9534e0990920')).toHaveCount(1)
    expect(await page.locator('.instagram__marco').evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(600) // altura reservada
  })

  test('el script de Elfsight solo se inyecta al acercarse la sección', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('script[src*="elfsightcdn"]')).toHaveCount(0)
    await page.locator('#instagram').scrollIntoViewIfNeeded()
    await expect(page.locator('script[src*="elfsightcdn"]')).toHaveCount(1)
  })

  test('si el widget no carga, queda el botón "Síguenos en Instagram @maskoteria_akyra"', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await page.locator('#instagram').scrollIntoViewIfNeeded()
    const boton = page.getByRole('link', { name: /Síguenos en Instagram @maskoteria_akyra/ })
    await expect(boton).toBeVisible()
    await expect(boton).toHaveAttribute('href', 'https://www.instagram.com/maskoteria_akyra/')
  })

  test.describe('con Elfsight real', () => {
    test.use({ conElfsight: true })
    test('carga sin errores de CSP (o muestra el botón de respaldo)', async ({ page }) => {
      test.setTimeout(60_000)
      await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => (window.__csp ||= []).push(`${e.violatedDirective} ${e.blockedURI}`)))
      await page.goto('/index.html?tema=ninguno')
      await page.locator('#instagram').scrollIntoViewIfNeeded()
      await page.waitForFunction(() => document.querySelector('[class^="elfsight-app-"] *') || !document.querySelector('.instagram__respaldo').hidden, null, { timeout: 30_000 })
      await page.waitForTimeout(1500)
      expect(await page.evaluate(() => window.__csp || [])).toEqual([])
    })
  })
})

test.describe('carrusel de marcas con logos', () => {
  test('todos los logos cargan y tienen alt; cada marca lleva al catálogo filtrado', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager' }))
    await page.waitForLoadState('networkidle')
    const logos = page.locator('#marcas .cinta__pista:not(.cinta__pista--copia) .marca img')
    expect(await logos.count()).toBeGreaterThanOrEqual(15)
    const rotos = await page.evaluate(() => [...document.querySelectorAll('#marcas img')].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src))
    expect(rotos).toEqual([])
    const sinAlt = await page.evaluate(() => [...document.querySelectorAll('#marcas img')].filter(i => !i.alt.trim()).length)
    expect(sinAlt).toBe(0)
    await expect(page.locator('#marcas .cinta__pista:not(.cinta__pista--copia) img[alt="Royal Canin"]')).toHaveCount(1)
    const enlaces = await page.locator('#marcas .cinta__pista:not(.cinta__pista--copia) a').evaluateAll(as => as.map(a => a.getAttribute('href')))
    expect(enlaces.every(h => h.startsWith('catalogo.html?marca='))).toBe(true)
  })

  test('las copias para la cinta infinita están ocultas y no se enfocan', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    const copia = page.locator('#marcas .cinta__pista--copia')
    await expect(copia).toHaveAttribute('aria-hidden', 'true')
    const enfocables = await copia.locator('a').evaluateAll(as => as.filter(a => a.tabIndex >= 0).length)
    expect(enfocables).toBe(0)
  })

  test('pausa con botón y queda quieto con movimiento reducido', async ({ browser, page }) => {
    await page.goto('/index.html?tema=ninguno')
    await page.locator('#marcas .cinta__pausa').click()
    await expect(page.locator('.cinta--marcas')).toHaveClass(/cinta--pausada/)
    const contexto = await browser.newContext({ reducedMotion: 'reduce' })
    const p2 = await contexto.newPage()
    await p2.addInitScript(() => localStorage.setItem('akyra_privacidad_aceptada', 'true'))
    await p2.goto('http://localhost:4173/index.html?tema=ninguno')
    expect(await p2.locator('#marcas .cinta__pista').first().evaluate(e => getComputedStyle(e).animationName)).toBe('none')
    await contexto.close()
  })

  test('el catálogo filtra por la marca del enlace', async ({ page }) => {
    await page.goto('/catalogo.html?marca=Royal%20Canin')
    await expect(page.locator('article.tarjeta').first()).toBeVisible()
    const marcas = await page.locator('article.tarjeta .tarjeta__marca').allTextContents()
    expect(marcas.length).toBeGreaterThan(0)
    expect(new Set(marcas.map(m => m.trim()))).toEqual(new Set(['Royal Canin']))
  })
})
