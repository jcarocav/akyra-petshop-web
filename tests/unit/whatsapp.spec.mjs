// Mensaje del pedido para WhatsApp (js/whatsapp.mjs)
import { expect, test } from '@playwright/test'
import { calcularTotales, construirMensaje, enlacePedido, enlaceWhatsapp, formatoCLP, limpiarCampo, LARGO_MAXIMO_ENLACE } from '../../js/whatsapp.mjs'

const lineas = [
  { nombre: 'Sobre Felix, Sabor Salmón 85 g', sku: 'GAT-FELI-006', talla: null, precio: 850, cantidad: 3, granel: false },
  { nombre: 'Nomade Gato Adulto a granel', sku: 'GRA-NOMA-001', talla: null, precio: 3400, cantidad: 1.5, granel: true },
  { nombre: 'Arnés Perro Leon Pet', sku: 'PER-LEON-002', talla: 'M', precio: 4500, cantidad: 1, granel: false }
]
const cliente = {
  nombre: 'Ñandú Pérez & Cía #1 🐶',
  telefono: '+56 9 1234 5678',
  entrega: 'despacho',
  direccion: 'Av. España 123, depto #4 & 5',
  zona: { nombre: 'Zona urbana', valor: 2000 },
  pago: 'Transferencia',
  comentarios: 'Tocar el timbre 🐾\nGracias & saludos'
}
const fecha = new Date(2026, 9, 25, 21, 5)

test('formato chileno de pesos', () => {
  expect(formatoCLP(12345)).toBe('$12.345')
  expect(formatoCLP(1234567)).toBe('$1.234.567')
  expect(formatoCLP(850)).toBe('$850')
})

test('totales con despacho', () => {
  const t = calcularTotales(lineas, cliente.zona)
  expect(t.productos).toBe(850 * 3 + 3400 * 1.5 + 4500)
  expect(t.despacho).toBe(2000)
  expect(t.total).toBe(t.productos + 2000)
})

test('el mensaje tiene encabezado, cada línea, total y datos del cliente', () => {
  const m = construirMensaje({ lineas, cliente, fecha })
  expect(m).toContain('*Nuevo pedido web — Maskotería Akyra*')
  expect(m).toContain('Fecha: 25-10-2026 21:05')
  expect(m).toContain('1. 3 × Sobre Felix, Sabor Salmón 85 g')
  expect(m).toContain('SKU GAT-FELI-006 · $850 c/u · Subtotal $2.550')
  expect(m).toContain('2. 1,5 kg × Nomade Gato Adulto a granel')
  expect(m).toContain('SKU GRA-NOMA-001 · $3.400 por kg · Subtotal $5.100')
  expect(m).toContain('3. 1 × Arnés Perro Leon Pet (talla M)')
  expect(m).toContain('Subtotal productos: $12.150')
  expect(m).toContain('Despacho (zona urbana): $2.000')
  expect(m).toContain('*Total: $14.150*')
  expect(m).toContain('Nombre: Ñandú Pérez & Cía #1 🐶')
  expect(m).toContain('Teléfono: +56 9 1234 5678')
  expect(m).toContain('Dirección: Av. España 123, depto #4 & 5')
  expect(m).toContain('Método de pago: Transferencia')
  expect(m).toContain('Tocar el timbre 🐾\nGracias & saludos')
})

test('retiro en sucursal: sin despacho', () => {
  const m = construirMensaje({ lineas, fecha, cliente: { ...cliente, entrega: 'retiro', sucursal: { nombre: 'Hornillas', direccion: 'Hornillas 080' } } })
  expect(m).toContain('Entrega: Retiro en sucursal Hornillas (Hornillas 080)')
  expect(m).not.toContain('Despacho (')
  expect(m).toContain('*Total: $12.150*')
})

test('el enlace va al número de la tienda y se decodifica idéntico (ñ, tildes, &, #, emojis)', () => {
  const texto = construirMensaje({ lineas, cliente, fecha })
  const enlace = enlaceWhatsapp('56986969111', texto)
  const url = new URL(enlace)
  expect(url.origin + url.pathname).toBe('https://wa.me/56986969111')
  expect(enlace).not.toMatch(/[ #&]+.*text=.*[ #]/) // nada sin codificar dentro del texto
  expect(url.searchParams.get('text')).toBe(texto)
  expect([...url.searchParams.keys()]).toEqual(['text']) // el & del cliente no partió el parámetro
})

test('limpia caracteres de control y símbolos de formato de WhatsApp', () => {
  expect(limpiarCampo('*Hola* _mundo_ ~x~ `y`')).toBe('Hola mundo x y')
  expect(limpiarCampo('a‮b\u0000c')).toBe('abc')
  expect(limpiarCampo('x'.repeat(500), { max: 80 })).toHaveLength(80)
  expect(limpiarCampo('uno\ndos', {})).toBe('uno dos')
})

test('pedidos largos: formato compacto y nada se corta', () => {
  const muchas = Array.from({ length: 45 }, (_, i) => ({
    nombre: `Producto de prueba número ${i + 1} con nombre largo, sabor salmón y atún 85 g`,
    sku: `SKU-${String(i + 1).padStart(3, '0')}`, talla: null, precio: 1000 + i, cantidad: 2, granel: false
  }))
  const { texto, enlace } = enlacePedido({ numero: '56986969111', lineas: muchas, cliente, fecha })
  const decodificado = new URL(enlace).searchParams.get('text')
  expect(decodificado).toBe(texto)
  for (const l of muchas) expect(decodificado).toContain(l.sku)
  expect(decodificado).toContain('*Total: ')
  expect(decodificado).toContain('Nombre: Ñandú')
  // corto: formato normal; largo: compacto
  expect(enlacePedido({ numero: '56986969111', lineas, cliente, fecha }).enlace.length).toBeLessThan(LARGO_MAXIMO_ENLACE)
})
