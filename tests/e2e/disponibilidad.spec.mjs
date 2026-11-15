// Disponibilidad sin Gesnex: un único aviso amarillo "Consultar disponibilidad"; con stock, ningún aviso
// ni número de unidades; los productos "consultar" se compran igual y WhatsApp lo indica.
import AxeBuilder from '@axe-core/playwright'
import { abrirCard, catalogo, conDatos, elegirProducto, expect, test } from './ayuda.mjs'

// (con mayúscula: "Disponible" era la insignia antigua; "Talla disponible" del filtro no cuenta)
const UNIDADES = /\d+\s*unidad(es)?\b(?! a )|[ÚúUu]ltim[oa]s? \d|¡[ÚU]ltim|\bDisponible\b|Agotado por ahora|Stock actualizado|kg disponibles|Máximo disponible/

test('un producto con stock no muestra ningún aviso ni número de unidades (card y ficha)', async ({ page }) => {
  await page.goto('/catalogo.html')
  const p = await elegirProducto(page, 'simple-con-stock')
  const card = await abrirCard(page, p)
  await expect(card.locator('[data-estado-stock]')).toHaveText('')
  await expect(card.locator('[data-estado-stock]')).toBeHidden()
  expect(await card.innerText()).not.toMatch(UNIDADES)
  await page.goto(`/producto.html?id=${p.id}`)
  await expect(page.locator('#ficha')).toBeVisible()
  await expect(page.locator('#ficha-stock')).toBeHidden()
  expect(await page.locator('main').innerText()).not.toMatch(UNIDADES)
})

test('ninguna página muestra cantidades de unidades ni datos de stock', async ({ page }) => {
  for (const ruta of ['/index.html', '/catalogo.html', '/catalogo.html?categoria=perros', '/catalogo.html?categoria=granel', '/catalogo.html?categoria=ropa']) {
    await page.goto(ruta)
    await expect(page.locator('article.tarjeta').first()).toBeVisible()
    expect(await page.locator('body').innerText(), ruta).not.toMatch(UNIDADES)
  }
  const datos = await catalogo(page)
  expect(JSON.stringify(datos.productos)).not.toMatch(/"(unidades|tope|stock)"/)
  const stock = await (await page.request.get('/stock.json')).json()
  for (const v of Object.values(stock.disponibilidad)) expect(['con-stock', 'consultar']).toContain(v)
})

test('"Consultar disponibilidad": amarillo, texto real y contraste AA', async ({ page }) => {
  await page.goto('/catalogo.html')
  const p = await elegirProducto(page, 'simple-consultar')
  const card = await abrirCard(page, p)
  const aviso = card.locator('[data-estado-stock]')
  await expect(aviso).toHaveText('Consultar disponibilidad')
  await expect(aviso).toHaveClass(/estado-stock--consultar/)
  const r = await new AxeBuilder({ page }).include(`article.tarjeta[data-producto="${p.id}"]`).withRules(['color-contrast']).analyze()
  expect(r.violations).toEqual([])
})

test('un producto de otra marca sin foto sí aparece, con la imagen de relleno', async ({ page }) => {
  await page.goto('/catalogo.html')
  const datos = await catalogo(page)
  const sinFoto = datos.productos.find(p => !p.imagen && !/mondo|marben|wonder|le[oó]n pet/i.test(`${p.marca} ${p.nombre}`))
  expect(sinFoto).toBeTruthy()
  const card = await abrirCard(page, sinFoto)
  await expect(card.locator('.foto-pendiente')).toBeVisible()
})

test('un producto de Mondo / Marben / Leon Pet con foto referencial aparece con su aviso', async ({ page }) => {
  await page.goto('/catalogo.html')
  const datos = await catalogo(page)
  const ref = datos.productos.find(p => p.imagenTipo === 'referencial' && /mondo|marben|le[oó]n pet/i.test(p.marca))
  expect(ref).toBeTruthy()
  const card = await abrirCard(page, ref)
  await expect(card.locator('.nota-referencial')).toHaveText('Imagen referencial')
  await expect(card.locator('.foto-pendiente')).toHaveCount(0)
})

test('un producto "consultar" se añade al carrito y su línea de WhatsApp dice "(consultar disponibilidad)"', async ({ page, context }) => {
  await page.goto('/catalogo.html')
  const c = await elegirProducto(page, 'simple-consultar')
  const s = await elegirProducto(page, 'simple-con-stock')
  for (const p of [c, s]) {
    const card = await abrirCard(page, p)
    await card.getByRole('button', { name: `Añadir ${p.nombre} al carrito` }).click()
    await expect(page.locator('#toast')).toContainText(`Agregado: 1 × ${p.nombre}`)
  }
  await page.locator('#boton-carrito').click()
  await expect(page.locator(`#carrito-lista li[data-clave="${c.id}"] .linea__disponibilidad`)).toHaveText('Consultar disponibilidad')
  await expect(page.locator(`#carrito-lista li[data-clave="${s.id}"] .linea__disponibilidad`)).toHaveCount(0)
  await page.getByRole('button', { name: 'Continuar compra' }).click()
  await page.getByLabel('Nombre *').fill('Prueba')
  await page.getByLabel('Teléfono *').fill('912345678')
  await page.getByLabel('Sucursal de retiro *').selectOption('hornillas')
  await page.locator('label[for="pago-2"]').click()
  const nueva = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click()
  const texto = new URL((await nueva).url()).searchParams.get('text')
  const lineaC = texto.split('\n').find(l => l.includes(`SKU ${c.sku}`))
  const lineaS = texto.split('\n').find(l => l.includes(`SKU ${s.sku}`))
  expect(lineaC).toMatch(/\(consultar disponibilidad\)$/)
  expect(lineaS).not.toContain('consultar disponibilidad')
})

test('el + del carrito no se bloquea por stock', async ({ page }) => {
  await page.goto('/catalogo.html')
  const p = await elegirProducto(page, 'simple-con-stock')
  await page.evaluate(p => localStorage.setItem('akyra_carrito_v2', JSON.stringify([{ id: p.id, talla: null, cantidad: 40 }])), p)
  await conDatos(page, { stockExtra: { [p.sku]: 'consultar' } })
  await page.reload()
  await page.locator('#boton-carrito').click()
  const linea = page.locator(`#carrito-lista li[data-clave="${p.id}"]`)
  await expect(linea.getByLabel(`Cantidad de ${p.nombre}`)).toHaveValue('40')
  await linea.getByRole('button', { name: `Sumar uno a ${p.nombre}` }).click()
  await expect(page.locator(`#carrito-lista li[data-clave="${p.id}"]`).getByLabel(`Cantidad de ${p.nombre}`)).toHaveValue('41')
})
