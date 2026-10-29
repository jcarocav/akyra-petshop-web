// Inicio: fotos de mascotas en las categorías y portada (hero) más baja con los controles adentro.
import { expect, test } from './ayuda.mjs'

const CATEGORIAS = ['perros', 'gatos', 'otras-mascotas', 'granel', 'accesorios', 'arena', 'ropa', 'salud-higiene']

test.describe('cards de categorías con foto', () => {
  test('cada card tiene su foto decorativa (alt vacío), cargada, y sigue siendo un solo enlace con su nombre', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager' }))
    await page.waitForLoadState('networkidle')
    const tarjetas = page.locator('#categorias a.categoria')
    await expect(tarjetas).toHaveCount(8)
    for (const id of CATEGORIAS) {
      const card = page.locator(`#categorias a.categoria[href="catalogo.html?categoria=${id}"]`)
      await expect(card).toHaveCount(1)
      const img = card.locator('img')
      await expect(img).toHaveCount(1)
      await expect(img).toHaveAttribute('alt', '')
      await expect(img).toHaveAttribute('src', `assets/img/categorias/${id}.webp`)
      expect(await img.evaluate(i => i.complete && i.naturalWidth > 0), id).toBe(true)
      // decorativa: oculta a lectores de pantalla; el nombre accesible es solo el texto de la card
      await expect(card.locator('.categoria__icono')).toHaveAttribute('aria-hidden', 'true')
      await expect(card.locator('.categoria__nombre')).toBeVisible()
    }
    expect(await page.locator('#categorias a.categoria a').count()).toBe(0)
  })

  test('el texto, el "desde…" y los enlaces siguen igual', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    const nombres = await page.locator('#categorias .categoria__nombre').allTextContents()
    expect(nombres).toEqual(['Perros', 'Gatos', 'Otras mascotas', 'Granel', 'Accesorios', 'Arena', 'Ropa', 'Salud/Higiene'])
    await expect(page.locator('a.categoria[href$="categoria=granel"] .categoria__detalle')).toContainText('desde 0,1 kg')
  })

  test('la foto no tapa el texto de la card y la card no se desborda (320, 390 y 640 px)', async ({ page, browserName }) => {
    // WebKit no deja bajar de ~346 px de ancho (también pasa en la versión anterior): ahí no se prueba el desborde
    for (const ancho of [320, 390, 640, 1366]) {
      await page.setViewportSize({ width: ancho, height: 900 })
      await page.goto('/index.html?tema=ninguno')
      await page.locator('#categorias').scrollIntoViewIfNeeded()
      if (browserName !== 'webkit') expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `desborde a ${ancho}px`).toBeLessThanOrEqual(1)
      const choques = await page.evaluate(() => {
        const malos = []
        for (const c of document.querySelectorAll('#categorias .categoria')) {
          const foto = c.querySelector('img').getBoundingClientRect()
          const caja = c.getBoundingClientRect()
          for (const t of c.querySelectorAll('.categoria__nombre, .categoria__detalle, .categoria__conteo')) {
            const r = document.createRange(); r.selectNodeContents(t)
            for (const l of r.getClientRects()) {
              const se_cruzan = l.left < foto.right - 1 && l.right > foto.left + 1 && l.top < foto.bottom - 1 && l.bottom > foto.top + 1
              if (se_cruzan) malos.push(`${c.getAttribute('href')} · ${t.className}`)
            }
          }
          if (foto.left < caja.left - 1 || foto.right > caja.right + 1) malos.push(`${c.getAttribute('href')}: la foto se sale de los lados`)
        }
        return malos
      })
      expect(choques, `a ${ancho}px`).toEqual([])
    }
  })

  test('en escritorio las cards miden lo mismo que antes (146 px y 166 px)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Medidas de escritorio')
    await page.setViewportSize({ width: 1366, height: 900 })
    await page.goto('/index.html?tema=ninguno')
    await page.locator('#categorias').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForLoadState('networkidle')
    const altos = await page.locator('#categorias a.categoria').evaluateAll(cs => cs.map(c => Math.round(c.getBoundingClientRect().height)))
    expect(altos.slice(0, 4).every(a => Math.abs(a - 146) <= 1) && altos.slice(4).every(a => Math.abs(a - 166) <= 1), JSON.stringify(altos)).toBe(true)
  })

  test('con movimiento reducido la foto no se mueve al pasar el mouse', async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 900 } })
    const page = await contexto.newPage()
    await page.addInitScript(() => localStorage.setItem('akyra_privacidad_aceptada', 'true'))
    await page.goto('http://localhost:4173/index.html?tema=ninguno')
    const card = page.locator('a.categoria').first()
    await card.scrollIntoViewIfNeeded()
    await card.hover()
    await page.waitForTimeout(200)
    // en reposo y con el mouse encima la foto está en el mismo lugar (sin subir 3 px)
    const y = () => card.locator('img').evaluate(i => Math.round(i.getBoundingClientRect().top * 10) / 10)
    const conMouse = await y()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(200)
    expect(await y()).toBe(conMouse)
    await contexto.close()
  })
})

test.describe('portada (hero) más baja', () => {
  test('en 1366×768 y 1920×1080 la franja de ayuda se ve completa sin hacer scroll', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Pantallas de escritorio')
    for (const [w, h] of [[1366, 768], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto('/index.html?tema=ninguno')
      await page.waitForLoadState('networkidle')
      const fin = await page.locator('.atajos').evaluate(e => Math.round(e.getBoundingClientRect().bottom))
      expect(fin, `${w}×${h}`).toBeLessThanOrEqual(h)
      await expect(page.getByText('¿Necesitas ayuda?')).toBeInViewport({ ratio: 1 })
    }
  })

  test('los controles están dentro del hero, abajo a la izquierda y alineados con el texto; no hay franja extra', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Escritorio')
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/index.html?tema=ninguno')
    const hero = await page.locator('.hero').boundingBox()
    const ctrl = await page.locator('.hero__controles').boundingBox()
    const texto = await page.locator('.hero__diapositiva.activa .hero__texto').boundingBox()
    expect(ctrl.y).toBeGreaterThanOrEqual(hero.y)
    expect(ctrl.y + ctrl.height).toBeLessThanOrEqual(hero.y + hero.height + 1)
    expect(Math.abs(ctrl.x - texto.x)).toBeLessThanOrEqual(2) // alineados a la izquierda con el texto
    expect(hero.y + hero.height - (ctrl.y + ctrl.height)).toBeLessThanOrEqual(24) // pegados abajo, sin franja propia
    const botonCta = await page.locator('.hero__diapositiva.activa .boton').boundingBox()
    expect(ctrl.y).toBeGreaterThanOrEqual(botonCta.y + botonCta.height) // no tapan el botón del hero
  })

  test('las fotos del hero no tapan el texto ni el botón en ninguna portada, y no se pixelan', async ({ page, isMobile }) => {
    test.setTimeout(60_000)
    for (const [w, h] of isMobile ? [[390, 844]] : [[1366, 768], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto('/index.html?tema=ninguno')
      await page.waitForLoadState('networkidle')
      for (let i = 0; i < 2; i++) {
        const r = await page.evaluate(() => {
          const d = document.querySelector('.hero__diapositiva.activa')
          const im = d.querySelector('.hero__imagen').getBoundingClientRect()
          const cajas = [...d.querySelectorAll('.hero__titulo, .hero__bajada, .boton')].map(e => e.getBoundingClientRect())
          const cruza = cajas.some(c => c.left < im.right - 4 && c.right > im.left + 4 && c.top < im.bottom - 4 && c.bottom > im.top + 4)
          const el = d.querySelector('.hero__imagen')
          return { cruza, escala: el.naturalWidth / el.getBoundingClientRect().width }
        })
        expect(r.cruza, `portada ${i + 1} a ${w}px`).toBe(false)
        expect(r.escala, 'foto con resolución suficiente').toBeGreaterThanOrEqual(0.99)
        await page.locator('#hero-siguiente').click()
        await page.waitForTimeout(700)
      }
    }
  })

  test('en celular el hero es compacto y la franja de ayuda aparece antes', async ({ page, isMobile, browserName }) => {
    const sinDesborde = async () => browserName === 'webkit' || expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    test.skip(!isMobile, 'Celular')
    await page.goto('/index.html?tema=ninguno')
    await page.waitForLoadState('networkidle')
    const hero = await page.locator('.hero').boundingBox()
    expect(hero.height).toBeLessThanOrEqual(460)
    const ctrl = await page.locator('.hero__controles').boundingBox()
    expect(ctrl.y + ctrl.height).toBeLessThanOrEqual(hero.y + hero.height + 1)
    await sinDesborde()
  })

  test('los controles siguen siendo accesibles: botones con nombre y pausa que funciona', async ({ page }) => {
    await page.goto('/index.html?tema=ninguno')
    await expect(page.getByRole('button', { name: 'Portada anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Portada siguiente' })).toBeVisible()
    const pausa = page.getByRole('button', { name: /carrusel de portada/ })
    await pausa.click()
    await expect(pausa).toHaveAttribute('aria-pressed', 'true')
    for (const id of ['#hero-anterior', '#hero-siguiente', '#hero-pausa']) {
      const caja = await page.locator(id).boundingBox()
      expect(caja.width).toBeGreaterThanOrEqual(24)
      expect(caja.height).toBeGreaterThanOrEqual(24)
    }
  })
})
