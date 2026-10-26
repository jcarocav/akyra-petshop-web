// Reglas del generador del catálogo (tools/catalogo/reglas.mjs)
import { expect, test } from '@playwright/test'
import {
  agruparTallas, deducirEdad, deducirSubcategoria, detectarTalla, esVisible, formatoMarca, formatoTitulo,
  nombreGranel, precioPublico, resumirStock, topePublico
} from '../../tools/catalogo/reglas.mjs'

test.describe('stock y visibilidad', () => {
  test('con cantidad registrada y suma 0 → oculto', () => {
    const s = resumirStock([0, null, 0])
    expect(s).toEqual({ registrado: true, total: 0 })
    expect(esVisible(s)).toBe(false)
  })
  test('sin ninguna cantidad registrada → visible y sin tope', () => {
    const s = resumirStock([null, null, ''])
    expect(s.registrado).toBe(false)
    expect(esVisible(s)).toBe(true)
    expect(topePublico(s, false)).toBeNull()
  })
  test('stock mayor que 0 → visible, tope = suma de las hojas', () => {
    const s = resumirStock([3, null, 5, 0])
    expect(esVisible(s)).toBe(true)
    expect(topePublico(s, false)).toBe(8)
  })
  test('granel: el tope son kilos en pasos de 0,5', () => {
    expect(topePublico(resumirStock([2.8, 1.1]), true)).toBe(3.5)
    expect(topePublico(resumirStock([0.225]), true)).toBe(0)
  })
})

test.describe('precio', () => {
  test('1, 0 o vacío es "sin precio"', () => {
    expect(precioPublico(1)).toBeNull()
    expect(precioPublico(0)).toBeNull()
    expect(precioPublico(null)).toBeNull()
    expect(precioPublico('')).toBeNull()
    expect(precioPublico(12990)).toBe(12990)
  })
})

test.describe('nombres', () => {
  test('pasa de MAYÚSCULAS a formato título sin tocar medidas', () => {
    expect(formatoTitulo('ALIMENTO ROYAL CANIN KITTEN 1,5 KG')).toBe('Alimento Royal Canin Kitten 1,5 Kg')
    expect(formatoTitulo('SOBRE FELIX, SABOR SALMON 85G')).toBe('Sobre Felix, Sabor Salmón 85 g')
    expect(formatoTitulo('ACONDICIONADOR PETBRILHO 500 ML')).toBe('Acondicionador Petbrilho 500 ml')
    expect(formatoTitulo('SNACK FIT FORMULA COSTILLITAS CARNE 100GR')).toBe('Snack Fit Formula Costillitas Carne 100 Gr')
  })
  test('quita las marcas internas de la planilla', () => {
    expect(formatoTitulo('LATA FANCY FEAST SABOR ATUN (2)')).toBe('Lata Fancy Feast Sabor Atún')
    expect(formatoTitulo('ARENA TOP-K9, 2 KG (VARIANTE 2206)')).toBe('Arena Top-K9, 2 Kg')
  })
  test('mantiene los códigos del fabricante', () => {
    expect(formatoTitulo('ALFOMBRA DOBLE MONDO (11428)')).toBe('Alfombra Doble Mondo (11428)')
  })
  test('marca con formato', () => {
    expect(formatoMarca('INABA')).toBe('Inaba')
    expect(formatoMarca('Mr.Dog')).toBe('Mr.Dog')
    expect(formatoMarca('Generico')).toBe('Genérico')
  })
  test('granel', () => {
    expect(nombreGranel('Nomade Gato Adulto (GRANEL)')).toBe('Nomade Gato Adulto a granel')
    expect(nombreGranel('GRANEL ALIMENTO ALFA DOG PERRO ADULTO')).toBe('Alfa Dog Perro Adulto a granel')
  })
})

test.describe('tallas', () => {
  test('reconoce los patrones de talla', () => {
    expect(detectarTalla('JAULA GATO MONDO TALLA L')).toMatchObject({ talla: 'L', base: 'JAULA GATO MONDO' })
    expect(detectarTalla('ARNES T-M ROJO')).toMatchObject({ talla: 'M' })
    expect(detectarTalla('PAÑAL SOFT CARE LARGE THXPET')).toMatchObject({ talla: 'L' })
    expect(detectarTalla('CHAQUETA MONDO TALLA 5 XL (15140)')).toMatchObject({ talla: '5XL' })
    expect(detectarTalla('POLERA #2')).toMatchObject({ talla: '#2' })
    expect(detectarTalla('ROPA TALLA 2')).toMatchObject({ talla: 'T2' })
    expect(detectarTalla('ARNES XL (72206)')).toMatchObject({ talla: 'XL' })
  })
  test('no confunde litros ni otros textos con tallas', () => {
    expect(detectarTalla('ARENA SANITARIA EASY CLEAN AROMA LAVANDA 10 L')).toBeNull()
    expect(detectarTalla('ALIMENTO ROYAL CANIN URINARY S/O 1,5 KG')).toBeNull()
  })
  test('agrupa variantes que solo difieren en la talla', () => {
    const items = [
      { codigo: '1', categoria: 'accesorios', nombre: 'JAULA GATO MONDO TALLA S' },
      { codigo: '2', categoria: 'accesorios', nombre: 'JAULA GATO MONDO TALLA M' },
      { codigo: '3', categoria: 'accesorios', nombre: 'JAULA GATO MONDO TALLA L' },
      { codigo: '4', categoria: 'accesorios', nombre: 'PLATO MONDO (11330)' }
    ]
    const grupos = agruparTallas(items)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].items.map(i => i.talla)).toEqual(['S', 'M', 'L'])
  })
  test('separa diseños distintos con la misma talla por cercanía del código', () => {
    const items = [
      { codigo: 'a', categoria: 'ropa', nombre: 'CHALECO LANA MONDO TALLA S (11814)' },
      { codigo: 'b', categoria: 'ropa', nombre: 'CHALECO LANA MONDO TALLA M (11815)' },
      { codigo: 'c', categoria: 'ropa', nombre: 'CHALECO LANA MONDO TALLA S (15309)' },
      { codigo: 'd', categoria: 'ropa', nombre: 'CHALECO LANA MONDO TALLA M (15310)' }
    ]
    const grupos = agruparTallas(items)
    expect(grupos).toHaveLength(2)
    for (const g of grupos) expect(g.items.map(i => i.talla)).toEqual(['S', 'M'])
  })
})

test.describe('subcategoría y edad', () => {
  test('deduce desde el nombre', () => {
    expect(deducirSubcategoria('gatos', 'SOBRE WHISKAS 1 + AÑOS, SABOR CARNE')).toBe('Alimento húmedo')
    expect(deducirSubcategoria('perros', 'ALIMENTO FIT FORMULA PERRO ADULTO, 20 KG')).toBe('Alimento seco')
    expect(deducirSubcategoria('perros', 'SNACK WANPY, SABOR CORDERO')).toBe('Snacks y premios')
    expect(deducirSubcategoria('accesorios', 'COLLAR (15544), MONDO')).toBe('Collares, correas y arneses')
    expect(deducirEdad('perros', 'SOBRE MASTER DOG PERRO CACHORRO, SABOR POLLO')).toBe('Cachorro o gatito')
    expect(deducirEdad('gatos', 'ALIMENTO BIOFRESH GATO SENIOR 1,5 KG')).toBe('Senior')
  })
})
