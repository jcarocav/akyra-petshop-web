// Catálogo: disponibilidad (sin ocultar por stock), precios, filtros, buscador, paginación, tallas y ficha.
import { catalogo, conDatos, elegirProducto, expect, test } from './ayuda.mjs'

// Productos de prueba (agotados, tallas mezcladas, sin precio) agregados a lo que recibe el navegador
async function conProductosAgotados(page) {
  await conDatos(page, {
    productosExtra: [
      { id: 'prueba-agotado', sku: 'PRUEBA-AGOTADO', nombre: 'Producto Prueba Agotado', marca: 'Prueba', categoria: 'accesorios', subcategoria: 'Varios', precio: 5000 },
      { id: 'prueba-tallas', sku: 'PRUEBA-TALLAS', nombre: 'Chaleco Prueba Tallas', marca: 'Prueba', categoria: 'ropa', subcategoria: 'Chalecos',
        tallas: [{ talla: 'S', sku: 'PRUEBA-T-S', precio: 3000 }, { talla: 'M', sku: 'PRUEBA-T-M', precio: 3500 }, { talla: 'XXL', sku: 'PRUEBA-T-XXL', precio: 3900 }] },
      { id: 'prueba-tallas-agotadas', sku: 'PRUEBA-TODAS-AGOTADAS', nombre: 'Parka Prueba Agotada', marca: 'Prueba', categoria: 'ropa', subcategoria: 'Chaquetas y parkas',
        tallas: [{ talla: 'S', sku: 'PRUEBA-A-S', precio: 3000 }, { talla: 'L', sku: 'PRUEBA-A-L', precio: 3000 }] },
      { id: 'prueba-precio-uno', sku: 'PRUEBA-UNO', nombre: 'Producto Prueba Sin Precio', marca: 'Prueba', categoria: 'accesorios', subcategoria: 'Varios', precio: null },
      { id: 'prueba-sin-dato', sku: 'PRUEBA-SIN-DATO', nombre: 'Producto Prueba Sin Dato', marca: 'Prueba', categoria: 'accesorios', subcategoria: 'Varios', precio: 2500 }
    ],
    stockExtra: {
      'PRUEBA-AGOTADO': 0, 'PRUEBA-T-S': 0, 'PRUEBA-T-M': 2, 'PRUEBA-T-XXL': 0, 'PRUEBA-A-S': 0, 'PRUEBA-A-L': 0,
      'PRUEBA-UNO': 3, 'PRUEBA-SIN-DATO': null
    }
  })
}

test('un producto con stock 0 SÍ aparece y muestra "Consultar disponibilidad", también en la ficha', async ({ page }) => {
  await conProductosAgotados(page)
  await page.goto('/catalogo.html?buscar=PRUEBA-AGOTADO')
  const card = page.locator('article.tarjeta[data-producto="prueba-agotado"]')
  await expect(card).toBeVisible()
  await expect(card.locator('[data-estado-stock]')).toHaveText('Consultar disponibilidad')
  await expect(card.getByRole('button', { name: /Añadir/ })).toBeVisible()
  await page.goto('/producto.html?id=prueba-agotado')
  await expect(page.locator('#ficha-stock')).toHaveText('Consultar disponibilidad')
  await expect(page.locator('#ficha')).not.toContainText('Agotado por ahora')
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/)
  await expect(page.locator('#ficha').getByRole('button', { name: /Añadir/ })).toBeVisible()
})

test('todas las tallas aparecen; las sin stock dicen "Consultar disponibilidad" al elegirlas', async ({ page }) => {
  await conProductosAgotados(page)
  await page.goto('/catalogo.html?buscar=PRUEBA-TALLAS')
  const card = page.locator('article.tarjeta[data-producto="prueba-tallas"]')
  await expect(card).toBeVisible()
  await expect(card.locator('.talla')).toHaveText(['S', 'M', 'XXL'])
  await expect(card.locator('[data-estado-stock]')).toHaveText('') // alguna talla tiene stock: sin aviso
  await card.locator('.talla', { hasText: 'S' }).click()
  await expect(card.locator('[data-estado-stock]')).toHaveText('Consultar disponibilidad')
  await card.locator('.talla', { hasText: 'M' }).click()
  await expect(card.locator('[data-estado-stock]')).toHaveText('')
  await expect(card.locator('[data-estado-stock]')).toBeHidden()
  // Una card con todas sus tallas sin stock se ve igual, con el aviso
  await page.goto('/catalogo.html?buscar=PRUEBA-TODAS-AGOTADAS')
  await expect(page.locator('article.tarjeta[data-producto="prueba-tallas-agotadas"] [data-estado-stock]')).toHaveText('Consultar disponibilidad')
})

test('un producto sin cantidad registrada aparece como "Consultar disponibilidad" y su + no tiene tope de stock', async ({ page }) => {
  await conProductosAgotados(page)
  await page.goto('/catalogo.html?buscar=PRUEBA-SIN-DATO')
  const card = page.locator('article.tarjeta[data-producto="prueba-sin-dato"]')
  await expect(card).toBeVisible()
  await expect(card.locator('[data-estado-stock]')).toHaveText('Consultar disponibilidad')
  await card.getByRole('button', { name: /Sumar uno/ }).click()
  await card.getByRole('button', { name: /Sumar uno/ }).click()
  await expect(card.getByRole('button', { name: /Sumar uno/ })).toHaveAttribute('aria-disabled', 'false')
})

test('el catálogo ya no muestra la fecha del stock', async ({ page }) => {
  await page.goto('/catalogo.html')
  await expect(page.locator('article.tarjeta').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Stock actualizado')
})

test('no se ve ningún precio "$1" y "Consultar precio" abre WhatsApp', async ({ page }) => {
  await conProductosAgotados(page)
  await page.goto('/catalogo.html?buscar=PRUEBA-UNO')
  const card = page.locator('article.tarjeta[data-producto="prueba-precio-uno"]')
  await expect(card.locator('.precio')).toContainText('Consultar precio')
  await expect(card.getByRole('button', { name: /Añadir/ })).toHaveCount(0)
  const enlace = card.getByRole('link', { name: /Consultar precio de Producto Prueba Sin Precio por WhatsApp/ })
  const href = await enlace.getAttribute('href')
  expect(href).toContain('https://wa.me/56986969111?text=')
  expect(decodeURIComponent(href.split('text=')[1])).toContain('Producto Prueba Sin Precio')
  for (const categoria of ['', 'perros', 'gatos', 'accesorios', 'salud-higiene']) {
    await page.goto(`/catalogo.html${categoria ? '?categoria=' + categoria : ''}`)
    await expect(page.locator('article.tarjeta').first()).toBeVisible()
    const texto = await page.locator('#catalogo-lista').innerText()
    expect(texto).not.toMatch(/\$1(?![\d.])/)
  }
})

test('pestañas de categoría, subcategoría, marca y buscador filtran bien', async ({ page }) => {
  await page.goto('/catalogo.html?categoria=gatos')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Productos para gatos')
  await expect(page.locator('#categorias-nav [aria-current="page"]')).toHaveText('Gatos')
  const datos = await catalogo(page)
  const ids = new Set(datos.productos.filter(p => p.categoria === 'gatos').map(p => p.id))
  for (const id of await page.locator('article.tarjeta').evaluateAll(els => els.map(e => e.dataset.producto))) expect(ids.has(id)).toBe(true)

  // Subcategoría (en celular el panel se abre con "Filtrar")
  const abrir = page.locator('#filtros-abrir')
  if (await abrir.isVisible()) await abrir.click()
  await page.locator('#filtro-subcategoria').getByLabel(/Alimento húmedo/).check()
  if (await page.locator('#filtros-ver-resultados').isVisible()) await page.locator('#filtros-ver-resultados').click()
  const humedos = new Set(datos.productos.filter(p => p.categoria === 'gatos' && p.subcategoria === 'Alimento húmedo').map(p => p.id))
  await expect(page.locator('#catalogo-conteo')).toContainText(`de ${humedos.size} productos`)
  await expect(page).toHaveURL(/tipo=Alimento/)
  for (const id of await page.locator('article.tarjeta').evaluateAll(els => els.map(e => e.dataset.producto))) expect(humedos.has(id)).toBe(true)

  // Marca
  await page.goto('/catalogo.html?categoria=gatos&marca=Royal%20Canin')
  for (const marca of await page.locator('.tarjeta__marca').allInnerTexts()) expect(marca.toLowerCase()).toBe('royal canin')

  // Buscador (por nombre, marca o código)
  await page.goto('/catalogo.html')
  await expect(page.locator('article.tarjeta').first()).toBeVisible() // el catálogo ya cargó y escucha el buscador
  await page.locator('#catalogo-buscar').fill('churu')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('churu')
  const nombres = await page.locator('article.tarjeta').evaluateAll(els => els.map(e => e.textContent.toLowerCase()))
  expect(nombres.length).toBeGreaterThan(3)
  for (const n of nombres) expect(n.includes('churu') || n.includes('inaba')).toBe(true)
  // Anuncio del número de resultados para lectores de pantalla
  await expect(page.locator('#anuncios')).toContainText(/productos? encontrados?/)
})

test('el buscador encuentra por código SKU y muestra estado vacío', async ({ page }) => {
  await page.goto('/catalogo.html')
  const p = await elegirProducto(page, 'simple-con-stock')
  await page.locator('#catalogo-buscar').fill(p.sku.toLowerCase())
  await expect(page.locator(`article.tarjeta[data-producto="${p.id}"]`)).toBeVisible()
  await page.locator('#catalogo-buscar').fill('zzzzproductoinexistente')
  await expect(page.locator('#catalogo-vacio')).toBeVisible()
  await expect(page.locator('#catalogo-vacio')).toContainText('No hay productos con ese filtro')
  await page.locator('#catalogo-limpiar').click()
  await expect(page.locator('article.tarjeta').first()).toBeVisible()
})

test('paginación: "Mostrar más" agrega productos y mueve el foco', async ({ page }) => {
  await page.goto('/catalogo.html')
  await expect(page.locator('article.tarjeta')).toHaveCount(24)
  await page.locator('#catalogo-mas').click()
  await expect(page.locator('article.tarjeta')).toHaveCount(48)
  await expect(page.locator('#catalogo-lista > li').nth(24).locator('.tarjeta__nombre a')).toBeFocused()
  await expect(page.locator('#catalogo-conteo')).toContainText('Mostrando 48 de')
})

test('filtro por talla: solo productos que tienen esa talla', async ({ page }) => {
  await page.goto('/catalogo.html?categoria=ropa')
  const datos = await catalogo(page)
  const conM = new Set(datos.productos.filter(p => p.tallas?.some(t => t.talla === 'M')).map(p => p.id))
  await page.goto('/catalogo.html?categoria=ropa&talla=M')
  const ids = await page.locator('article.tarjeta').evaluateAll(els => els.map(e => e.dataset.producto))
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) expect(conM.has(id)).toBe(true)
})

test('ficha de producto: título, descripción y datos estructurados propios', async ({ page }) => {
  await page.goto('/catalogo.html')
  const p = await elegirProducto(page, 'simple-con-stock')
  await page.goto(`/producto.html?id=${p.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.nombre)
  await expect(page).toHaveTitle(new RegExp(p.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const descripcion = await page.locator('meta[name="description"]').getAttribute('content')
  expect(descripcion).toContain(p.nombre)
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').last().textContent())
  expect(ld['@type']).toBe('Product')
  expect(ld.sku).toBe(p.sku)
  expect(ld.offers.price).toBe(p.precio)
  expect(ld.offers.priceCurrency).toBe('CLP')
  expect(ld.offers.availability).toBe('https://schema.org/InStock')
  expect(JSON.stringify(ld)).not.toMatch(/costo|tope|unidades|proveedor/i)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`producto\\.html\\?id=${p.id}$`))
  // Producto inexistente
  await page.goto('/producto.html?id=no-existe')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Este producto no está disponible')
})
