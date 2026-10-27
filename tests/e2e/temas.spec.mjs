// Temas de temporada en el navegador: se fija la fecha y se revisa la decoración.
import { expect, test } from './ayuda.mjs'

async function abrirEn(page, fecha, ruta = 'index.html') {
  await page.clock.setFixedTime(new Date(fecha))
  await page.goto(ruta)
  await expect(page.locator('html')).toHaveClass(/js/)
}

test('en octubre se ve Halloween: guirnalda, detalle en la portada y en el pie', async ({ page }) => {
  await abrirEn(page, '2026-10-15T12:00:00-03:00')
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'halloween')
  const guirnalda = page.locator('.tema-guirnalda')
  await expect(guirnalda).toHaveCount(1)
  await expect(guirnalda).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.hero .tema-adorno')).toHaveCount(1)
  await expect(page.locator('.tema-adorno-pie')).toHaveCount(1)
  // Solo decoración: no recibe clics ni tapa el carrito
  await expect(guirnalda).toHaveCSS('pointer-events', 'none')
  await page.locator('#boton-carrito').click()
  await expect(page.locator('#carrito')).toBeVisible()
})

test('fuera de fecha no hay ninguna decoración', async ({ page }) => {
  await abrirEn(page, '2026-11-15T12:00:00-03:00')
  await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.+/)
  await expect(page.locator('.tema-guirnalda, .tema-adorno, .tema-adorno-pie')).toHaveCount(0)
})

test('Fiestas Patrias: guirnalda todo septiembre y portada solo hasta el 20', async ({ page }) => {
  await abrirEn(page, '2026-09-10T12:00:00-03:00')
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'fiestas-patrias')
  await expect(page.locator('[data-portada="fiestas-patrias"]')).toHaveCount(1)
  await abrirEn(page, '2026-09-25T12:00:00-03:00')
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'fiestas-patrias')
  await expect(page.locator('[data-portada="fiestas-patrias"]')).toHaveCount(0)
})

test('Día del Animal: suma su detalle sin tapar Halloween', async ({ page }) => {
  await abrirEn(page, '2026-10-04T12:00:00-03:00')
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'halloween')
  await expect(page.locator('.hero .tema-adorno')).toHaveCount(2)
})

test('vista previa con ?tema= sin esperar la fecha, también en otras páginas', async ({ page }) => {
  await abrirEn(page, '2026-03-10T12:00:00-03:00', 'index.html?tema=navidad')
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'navidad')
  await expect(page.locator('.tema-guirnalda')).toHaveCount(1)
  await abrirEn(page, '2026-10-15T12:00:00-03:00', 'catalogo.html?tema=ninguno')
  await expect(page.locator('.tema-guirnalda')).toHaveCount(0)
  await abrirEn(page, '2026-03-10T12:00:00-03:00', 'contactenos.html?tema=dia-perro')
  await expect(page.locator('.tema-guirnalda')).toHaveCount(1)
})
