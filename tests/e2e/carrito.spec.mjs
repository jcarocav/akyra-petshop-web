// Carrito y pedido por WhatsApp (flujo de 2 pasos + confirmación).
import { NUMERO_TIENDA, abrirCard, carritoGuardado, elegirProducto, expect, formatoCLP, test } from './ayuda.mjs'

async function prepararCarrito(page) {
  await page.goto('/catalogo.html')
  const a = await elegirProducto(page, 'simple-mucho-stock')
  const g = await elegirProducto(page, 'granel')
  await page.evaluate(([a, g]) => localStorage.setItem('akyra_carrito_v2', JSON.stringify([
    { id: a.id, talla: null, cantidad: 2 },
    { id: g.id, talla: null, cantidad: 1.5 }
  ])), [a, g])
  await page.reload()
  return { a, g }
}

async function abrirCarrito(page) {
  await page.locator('#boton-carrito').click()
  await expect(page.getByRole('dialog', { name: 'Tu carrito' })).toBeVisible()
}

test('cambiar cantidad, quitar y totales correctos; se mantiene al recargar', async ({ page }) => {
  const { a, g } = await prepararCarrito(page)
  await expect(page.locator('#contador-carrito')).toHaveText('3') // 2 unidades + 1 producto a granel
  await abrirCarrito(page)
  const lineaA = page.locator(`#carrito-lista li[data-clave="${a.id}"]`)
  const lineaG = page.locator(`#carrito-lista li[data-clave="${g.id}"]`)
  await expect(lineaA.locator('.linea__subtotal')).toContainText(formatoCLP(a.precio * 2))
  await expect(lineaG.locator('.linea__subtotal')).toContainText(formatoCLP(g.precio * 1.5))
  await expect(page.locator('#carrito-subtotal')).toHaveText(formatoCLP(a.precio * 2 + g.precio * 1.5))

  // Con teclado (Safari no enfoca los botones al hacer clic)
  await lineaA.getByRole('button', { name: `Sumar uno a ${a.nombre}` }).focus()
  await page.keyboard.press('Enter')
  await expect(lineaA.getByLabel(`Cantidad de ${a.nombre}`)).toHaveValue('3')
  await expect(lineaA.getByRole('button', { name: `Sumar uno a ${a.nombre}` })).toBeFocused() // el foco no se pierde
  await lineaG.getByRole('button', { name: `Restar medio kilo a ${g.nombre}` }).click()
  await expect(lineaG.getByLabel(`Kilos de ${g.nombre}`)).toHaveValue('1')
  await expect(page.locator('#carrito-subtotal')).toHaveText(formatoCLP(a.precio * 3 + g.precio * 1))

  await lineaG.getByRole('button', { name: `Quitar ${g.nombre} del carrito` }).click()
  await expect(lineaG).toHaveCount(0)
  await expect(page.locator('#carrito-subtotal')).toHaveText(formatoCLP(a.precio * 3))
  await expect(page.locator('#anuncios')).toContainText('quitado del carrito')

  await page.reload()
  expect(await carritoGuardado(page)).toEqual([{ id: a.id, talla: null, cantidad: 3 }])
  await abrirCarrito(page)
  await expect(page.locator('#carrito-subtotal')).toHaveText(formatoCLP(a.precio * 3))
})

test('el carrito se cierra con Esc y devuelve el foco al botón', async ({ page }) => {
  await prepararCarrito(page)
  await page.locator('#boton-carrito').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#carrito')).toBeVisible()
  await expect(page.locator('#carrito-titulo')).toBeFocused()
  // El foco queda atrapado dentro del carrito
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.getElementById('carrito').contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('#carrito')).toBeHidden()
  await expect(page.locator('#boton-carrito')).toBeFocused()
})

test('paso 2: los errores se anuncian y se marcan los campos', async ({ page }) => {
  await prepararCarrito(page)
  await abrirCarrito(page)
  await page.getByRole('button', { name: 'Continuar compra' }).click()
  await expect(page.locator('#carrito-titulo')).toHaveText('Tus datos')
  await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click()
  await expect(page.locator('#pedido-errores')).toBeVisible()
  await expect(page.locator('#pedido-nombre')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#pedido-nombre')).toBeFocused()
  await expect(page.locator('#anuncios-urgentes')).toContainText('No se pudo enviar')
  await expect(page.locator('#grupo-pago-error')).toHaveText('Elige el método de pago.')
})

test('pedido por WhatsApp: enlace al número de la tienda con todas las líneas, total, despacho y datos (ñ, tildes, &, #, emoji)', async ({ page, context }) => {
  const { a, g } = await prepararCarrito(page)
  await abrirCarrito(page)
  await page.getByRole('button', { name: 'Continuar compra' }).click()
  await page.getByLabel('Nombre *').fill('Ñandú Pérez & Cía #1 🐶')
  await page.getByLabel('Teléfono *').fill('+56 9 1234 5678')
  await page.locator('label[for="entrega-despacho"]').click()
  await page.getByLabel('Dirección de despacho *').fill('Av. España 123, depto #4 & 5')
  await page.locator('label[for="zona-periferia"]').click()
  await page.locator('label[for="pago-0"]').click()
  await expect(page.locator('#pago-0')).toBeChecked()
  await page.getByLabel('Comentarios (opcional)').fill('Tocar el timbre 🐾\nGracias & saludos')
  const productos = a.precio * 2 + g.precio * 1.5
  await expect(page.locator('#pedido-despacho')).toHaveText('$3.500')
  await expect(page.locator('#pedido-total')).toHaveText(formatoCLP(productos + 3500))

  const nuevaPagina = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click()
  const wa = await nuevaPagina
  const url = new URL(wa.url())
  expect(url.hostname).toBe('wa.me')
  expect(url.pathname).toBe(`/${NUMERO_TIENDA}`)
  const texto = url.searchParams.get('text')
  expect(texto).toContain('*Nuevo pedido web — Maskotería Akyra*')
  expect(texto).toMatch(/Fecha: \d{2}-\d{2}-\d{4} \d{2}:\d{2}/)
  expect(texto).toContain(`1. 2 × ${a.nombre}`)
  expect(texto).toContain(`SKU ${a.sku} · ${formatoCLP(a.precio)} c/u · Subtotal ${formatoCLP(a.precio * 2)}`)
  expect(texto).toContain(`2. 1,5 kg × ${g.nombre}`)
  expect(texto).toContain(`${formatoCLP(g.precio)} por kg · Subtotal ${formatoCLP(g.precio * 1.5)}`)
  expect(texto).toContain(`Subtotal productos: ${formatoCLP(productos)}`)
  expect(texto).toContain('Despacho (periferia): $3.500')
  expect(texto).toContain(`*Total: ${formatoCLP(productos + 3500)}*`)
  expect(texto).toContain('Nombre: Ñandú Pérez & Cía #1 🐶')
  expect(texto).toContain('Teléfono: +56 9 1234 5678')
  expect(texto).toContain('Dirección: Av. España 123, depto #4 & 5')
  expect(texto).toContain('Método de pago: Transferencia')
  expect(texto).toContain('Tocar el timbre 🐾\nGracias & saludos')
  expect([...url.searchParams.keys()]).toEqual(['text'])

  // Confirmación: explica que hay que apretar "Enviar" en WhatsApp
  await expect(page.locator('#carrito-titulo')).toHaveText('Pedido listo')
  await expect(page.locator('#carrito-paso-3')).toContainText('Aprieta Enviar')
  await expect(page.locator('#pedido-enlace')).toHaveAttribute('href', wa.url())
})

test('retiro en sucursal: sin costo de despacho', async ({ page, context }) => {
  const { a, g } = await prepararCarrito(page)
  await abrirCarrito(page)
  await page.getByRole('button', { name: 'Continuar compra' }).click()
  await page.getByLabel('Nombre *').fill('Rosa')
  await page.getByLabel('Teléfono *').fill('986969111')
  await page.getByLabel('Sucursal de retiro *').selectOption('las-lengas')
  await page.locator('label[for="pago-2"]').click()
  await expect(page.locator('#pago-2')).toBeChecked()
  await expect(page.locator('#pedido-despacho')).toHaveText('Gratis (retiro)')
  const nuevaPagina = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Enviar pedido por WhatsApp' }).click()
  const texto = new URL((await nuevaPagina).url()).searchParams.get('text')
  expect(texto).toContain('Entrega: Retiro en sucursal Las Lengas (Av. Circunvalación Ramón Cañas 340)')
  expect(texto).toContain(`*Total: ${formatoCLP(a.precio * 2 + g.precio * 1.5)}*`)
  expect(texto).not.toContain('Despacho (')
})

test('lo guardado en el navegador se valida: datos falsos o productos inexistentes se descartan', async ({ page }) => {
  await page.goto('/catalogo.html')
  const a = await elegirProducto(page, 'simple-tope-chico')
  await page.evaluate(a => localStorage.setItem('akyra_carrito_v2', JSON.stringify([
    { id: '<img src=x onerror=alert(1)>', talla: null, cantidad: 2 },
    { id: a.id, talla: null, cantidad: 999, nombre: '<b>falso</b>', precio: 1 },
    'basura', null
  ])), a)
  await page.reload()
  expect(await carritoGuardado(page)).toEqual([{ id: a.id, talla: null, cantidad: a.tope }])
  await page.locator('#boton-carrito').click()
  await expect(page.locator('#carrito-lista li')).toHaveCount(1)
  await expect(page.locator('#carrito-lista')).toContainText(a.nombre)
  await expect(page.locator('#carrito-lista')).toContainText(formatoCLP(a.precio))
  await expect(page.locator('#carrito-lista b')).toHaveCount(0)
})

test('agregar desde la card actualiza el carrito abierto en otra página', async ({ page }) => {
  await page.goto('/catalogo.html')
  const a = await elegirProducto(page, 'simple-mucho-stock')
  const card = await abrirCard(page, a)
  await card.getByRole('button', { name: `Añadir ${a.nombre} al carrito` }).click()
  await page.goto('/contactenos.html')
  await expect(page.locator('#contador-carrito')).toHaveText('1')
})
