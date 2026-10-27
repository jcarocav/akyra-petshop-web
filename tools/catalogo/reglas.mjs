// ============================================================
// Reglas del catálogo: funciones puras (sin leer archivos) que usa
// tools/generar-catalogo.mjs. Están separadas para poder probarlas
// con tests/unit/reglas.spec.mjs.
// ============================================================

export const CATEGORIAS = [
  { id: 'perros', nombre: 'Perros', excel: 'Perros', titulo: 'Productos para perros' },
  { id: 'gatos', nombre: 'Gatos', excel: 'Gatos', titulo: 'Productos para gatos' },
  { id: 'otras-mascotas', nombre: 'Otras mascotas', excel: 'Otras mascotas', titulo: 'Otras mascotas' },
  { id: 'granel', nombre: 'Granel', excel: 'Granel', titulo: 'Alimento a granel' },
  { id: 'accesorios', nombre: 'Accesorios', excel: 'Accesorios', titulo: 'Accesorios' },
  { id: 'arena', nombre: 'Arena', excel: 'Arena', titulo: 'Arena sanitaria' },
  { id: 'ropa', nombre: 'Ropa', excel: 'Ropa', titulo: 'Ropa para mascotas' },
  { id: 'salud-higiene', nombre: 'Salud/Higiene', excel: 'Salud/Higiene', titulo: 'Salud e higiene' }
]

const CATEGORIA_POR_EXCEL = new Map(CATEGORIAS.map(c => [c.excel.toLowerCase(), c.id]))

export function categoriaDesdeExcel(valor) {
  return CATEGORIA_POR_EXCEL.get(String(valor || '').trim().toLowerCase()) || null
}

// ---------- Números y textos ----------

export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const n = Number(String(valor).replace(/\./g, '').replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

export function sinTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function slug(texto) {
  return sinTildes(texto).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// ---------- Precio ----------

// En la planilla, 1 (o vacío / 0) es el marcador de "sin precio".
export function precioPublico(valor) {
  const n = aNumero(valor)
  if (n === null || n <= 1) return null
  return Math.round(n)
}

// ---------- Stock y visibilidad ----------

// unidades: lista de valores de la columna UNIDADES de todas las hojas
// donde aparece el código (null = celda vacía).
// Devuelve { registrado, total }:
//  - registrado=false → no hay ninguna cantidad escrita (se muestra, sin tope)
//  - registrado=true  → total = suma de lo registrado
export function resumirStock(unidades) {
  const registradas = unidades.map(aNumero).filter(n => n !== null)
  if (registradas.length === 0) return { registrado: false, total: null }
  const total = Math.round(registradas.reduce((a, b) => a + b, 0) * 1000) / 1000
  return { registrado: true, total }
}

// Regla del dueño: con cantidad registrada y suma 0 → oculto.
// Sin ninguna cantidad registrada → visible. Con stock > 0 → visible.
export function esVisible(stock) {
  if (!stock.registrado) return true
  return stock.total > 0
}

// Tope de cantidad que se publica (nunca el detalle por sucursal).
// Granel: kilos, redondeados hacia abajo a gramos (3 decimales).
export function topePublico(stock, granel) {
  if (!stock.registrado) return null
  if (granel) return Math.floor(Math.round(stock.total * 1e6) / 1000) / 1000
  return Math.floor(stock.total)
}

// ---------- Nombres en formato título ----------

const MINUSCULAS = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'sin', 'u', 'y', 'c/u'
])

const UNIDADES = {
  KG: 'Kg', KGS: 'Kg', GR: 'Gr', GRS: 'Gr', G: 'g', ML: 'ml', L: 'L', LT: 'L', LTS: 'L',
  CM: 'cm', MT: 'm', MTS: 'm', UDS: 'uds', UD: 'ud', UND: 'ud', UNDS: 'uds', PCS: 'pcs', U: 'u'
}

// Palabras que van siempre así (siglas, marcas con mayúsculas propias).
const FIJAS = new Map(Object.entries({
  'N&D': 'N&D', 'S/O': 'S/O', 'XS': 'XS', 'S': 'S', 'M': 'M', 'L': 'L', 'XL': 'XL', 'XXL': 'XXL',
  'XXXL': 'XXXL', 'XXXXL': 'XXXXL', 'USA': 'USA', 'GPT': 'GPT', 'PK-2': 'PK-2', 'TOP-K9': 'Top-K9',
  'K9': 'K9', 'MR.DOG': 'Mr. Dog', 'OMEGAS+': 'Omegas+', 'PETEGOU': 'Petegou', 'BIOLINE': 'Bioline',
  'BRNX': 'BRNX', 'THXPET': 'Thxpet', 'INABA': 'Inaba', 'PROPLAN': 'Pro Plan', 'VETLIFE': 'Vet Life',
  'MARBENPETS': 'Marben Pets', 'TASTYFARM': 'Tasty Farm', 'WONDERPET': 'Wonder Pet', 'WONDERPETS': 'Wonder Pets',
  'DELIMIX': 'Delimix', 'CHURU': 'Churu', 'PH': 'pH', 'X-LARGE': 'X-Large'
}))

// Palabras frecuentes que en la planilla vienen sin tilde (no son marcas).
const TILDES = Object.fromEntries(Object.entries({
  ATUN: 'Atún', SALMON: 'Salmón', CAMARON: 'Camarón', OSTION: 'Ostión', LIMON: 'Limón', HIGADO: 'Hígado',
  CORAZON: 'Corazón', RATON: 'Ratón', RATONCITO: 'Ratoncito', TUNEL: 'Túnel', ARNES: 'Arnés', COJIN: 'Cojín',
  PLASTICO: 'Plástico', PLASTICA: 'Plástica', ELECTRICO: 'Eléctrico', METALICAS: 'Metálicas', ECOLOGICA: 'Ecológica',
  HIPOALERGENICO: 'Hipoalergénico', MULTIVITAMINICO: 'Multivitamínico', VITAMINICO: 'Vitamínico', RETRACTIL: 'Retráctil',
  CARBON: 'Carbón', CAFE: 'Café', BEBE: 'Bebé', OIDOS: 'Oídos', GENERICA: 'Genérica', GENERICO: 'Genérico',
  PROBIOTICOS: 'Probióticos', LACTEO: 'Lácteo', PATE: 'Paté', BOTON: 'Botón', FEMUR: 'Fémur', TRAQUEA: 'Tráquea',
  INTERACTIVO: 'Interactivo', ALGODON: 'Algodón', JABON: 'Jabón', CASCABEL: 'Cascabel', ARANAZOS: 'Arañazos',
  ANTIARANAZOS: 'Antiarañazos', PANAL: 'Pañal', DISENO: 'Diseño', MENUDENCIAS: 'Menudencias', VICERAS: 'Vísceras',
  ESTOMAGO: 'Estómago', CONVALECIENTE: 'Convaleciente', MAS: 'Más', TAMANOS: 'Tamaños', ANOS: 'Años',
  PEQUENA: 'Pequeña', PEQUENAS: 'Pequeñas', PEQUENOS: 'Pequeños', UNICA: 'Única', CLASICO: 'Clásico', MAGICO: 'Mágico'
}))

function capitalizar(palabra) {
  if (!palabra) return palabra
  const minus = palabra.toLocaleLowerCase('es-CL')
  // Respeta guiones y apóstrofos: "top-k9" → "Top-K9"
  return minus.replace(/(^|[-'’/])(\p{L})/gu, (_, sep, letra) => sep + letra.toLocaleUpperCase('es-CL'))
}

function formatearToken(token, esPrimero) {
  if (!token) return token
  // Signos al inicio/fin: "(11219)" "SABOR," etc.
  const m = token.match(/^([("'¿¡]*)(.*?)([)"',.;:!?]*)$/u)
  const [, ini, cuerpo, fin] = m
  if (!cuerpo) return token
  const mayus = cuerpo.toLocaleUpperCase('es-CL')

  if (FIJAS.has(mayus)) return ini + FIJAS.get(mayus) + fin
  if (UNIDADES[mayus]) return ini + UNIDADES[mayus] + fin

  // Número pegado a unidad: "85G", "100GR", "1,5KG", "2PCS", "7,6LT"
  const nu = mayus.match(/^(\d+(?:[.,]\d+)?)([A-Z]+)$/)
  if (nu && UNIDADES[nu[2]]) return ini + nu[1] + ' ' + UNIDADES[nu[2]] + fin

  // Códigos (con dígitos) o siglas cortas entre paréntesis: se dejan tal cual
  if (/\d/.test(cuerpo) || (ini.includes('(') && cuerpo.length <= 3)) return ini + cuerpo + fin

  const lower = cuerpo.toLocaleLowerCase('es-CL')
  if (TILDES[mayus]) return ini + (!esPrimero && MINUSCULAS.has(lower) ? TILDES[mayus].toLowerCase() : TILDES[mayus]) + fin
  if (!esPrimero && MINUSCULAS.has(lower)) return ini + lower + fin
  return ini + capitalizar(cuerpo) + fin
}

// Marcas internas de la planilla que no le sirven al cliente: "(2)", "(VARIANTE)",
// "(BODEGA)", "(agregado por Joaquín)". Los códigos del fabricante, como "(11218)", se mantienen.
export function limpiarNombre(nombre) {
  return String(nombre || '')
    .replace(/\(\s*\d\s*\)/g, '')
    .replace(/\(\s*VARIANTE[^)]*\)/gi, '')
    .replace(/\(\s*BODEGA\s*\)/gi, '')
    .replace(/\(\s*agregado por [^)]*\)/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatoTitulo(nombre) {
  const limpio = limpiarNombre(nombre)
  if (!limpio) return ''
  const tokens = limpio.split(' ')
  return tokens.map((t, i) => formatearToken(t, i === 0)).join(' ')
}

// ---------- Marcas ----------

export function formatoMarca(marca) {
  const m = String(marca || '').trim()
  if (!m || /^gen[eé]ric[oa]$/i.test(m)) return 'Genérico'
  // Si ya viene en mayúsculas y minúsculas, se respeta (p. ej. "Mr.Dog", "N&D")
  if (m !== m.toUpperCase()) return m
  return formatoTitulo(m)
}

// ---------- Tallas ----------

const TALLAS_ORDEN = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', '5XL']
const TALLAS_INGLES = { 'X-SMALL': 'XS', SMALL: 'S', MEDIUM: 'M', LARGE: 'L', 'X-LARGE': 'XL', 'XX-LARGE': 'XXL' }
const ES_TALLA_LETRA = /^(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)$/

function esNumero(token) {
  return /^\d+(?:[.,]\d+)?$/.test(token || '')
}

// Busca una talla en el nombre. Devuelve { talla, base } o null.
// Reconoce: "TALLA S", "TALLA 5 XL", "TALLA 2", "T-M", "#1", "N° 2",
// " S", " XL" (sueltas, no después de un número: "10 L" son litros),
// y SMALL / MEDIUM / LARGE / X-LARGE.
export function detectarTalla(nombre) {
  const original = String(nombre || '').replace(/\s+/g, ' ').trim()
  const texto = original.toUpperCase()
  const tokens = texto.split(' ')
  const limpiar = t => t.replace(/[,;.]+$/, '')

  for (let i = 0; i < tokens.length; i++) {
    const t = limpiar(tokens[i])
    const sig = limpiar(tokens[i + 1] || '')
    const sig2 = limpiar(tokens[i + 2] || '')

    if (t === 'TALLA' && sig) {
      if (esNumero(sig) && sig2 === 'XL') return armar(i, 3, sig + 'XL')
      if (ES_TALLA_LETRA.test(sig)) return armar(i, 2, sig)
      if (esNumero(sig)) return armar(i, 2, 'T' + sig)
    }
    const tGuion = t.match(/^T-(XXS|XS|S|M|L|XL|XXL|XXXL)$/)
    if (tGuion) return armar(i, 1, tGuion[1])
    const numeral = t.match(/^#(\d+)$/)
    if (numeral) return armar(i, 1, '#' + numeral[1])
    if ((t === 'N°' || t === 'NO.' || t === 'Nº') && esNumero(sig)) return armar(i, 2, 'N°' + sig)
    const nPegado = t.match(/^N[°º](\d+)$/)
    if (nPegado) return armar(i, 1, 'N°' + nPegado[1])
    if (TALLAS_INGLES[t]) return armar(i, 1, TALLAS_INGLES[t])
    if (i > 0 && ES_TALLA_LETRA.test(t) && !esNumero(limpiar(tokens[i - 1]))) return armar(i, 1, t)
  }
  return null

  function armar(inicio, largo, talla) {
    const partes = original.split(' ')
    partes.splice(inicio, largo)
    const base = partes.join(' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/[,\s]+$/, '').replace(/\s+/g, ' ').trim()
    return { talla, base }
  }
}

export function ordenTalla(talla) {
  const i = TALLAS_ORDEN.indexOf(talla)
  if (i >= 0) return i
  const n = String(talla).match(/(\d+)/)
  return 100 + (n ? Number(n[1]) : 0)
}

// Código entre paréntesis al final del nombre: "(13798)", "(X06474)".
export function codigoParentesis(texto) {
  const m = String(texto || '').match(/\(([^()]*\d[^()]*)\)\s*$/)
  if (!m) return null
  return { codigo: m[1], numero: Number((m[1].match(/\d+/g) || []).join('')) || null, sinCodigo: texto.replace(/\s*\([^()]*\)\s*$/, '').trim() }
}

// Agrupa variantes que solo difieren en la talla.
// items: [{ clave, categoria, nombre, ... }]
// Devuelve una lista de grupos: [{ base, items:[{...item, talla}] }] (solo grupos de 2+ tallas distintas).
export function agruparTallas(items) {
  const candidatos = new Map()
  for (const item of items) {
    const det = detectarTalla(item.nombre)
    if (!det) continue
    const cod = codigoParentesis(det.base)
    const baseSinCodigo = cod ? cod.sinCodigo : det.base
    const clave = item.categoria + '|' + slug(baseSinCodigo)
    if (!candidatos.has(clave)) candidatos.set(clave, [])
    candidatos.get(clave).push({ ...item, talla: det.talla, base: baseSinCodigo, numero: cod?.numero ?? null })
  }

  const grupos = []
  for (const lista of candidatos.values()) {
    if (lista.length < 2) continue
    const tallas = new Set(lista.map(x => x.talla))
    const numeros = lista.map(x => x.numero)
    const sinCodigos = numeros.every(n => n === null)
    const mismoCodigo = !sinCodigos && numeros.every(n => n === numeros[0])
    if (tallas.size === lista.length && (sinCodigos || mismoCodigo)) {
      grupos.push(lista)
      continue
    }
    // Hay tallas repetidas (p. ej. tres chalecos M de distinto diseño):
    // se separan por cercanía del código del fabricante (11814 S, 11815 M, 11816 L).
    const conNumero = lista.filter(x => x.numero !== null).sort((a, b) => a.numero - b.numero)
    let actual = []
    for (const x of conNumero) {
      const ultimo = actual[actual.length - 1]
      const repetida = actual.some(y => y.talla === x.talla)
      if (ultimo && (Math.abs(x.numero - ultimo.numero) > 3 || repetida)) {
        if (actual.length >= 2) grupos.push(actual)
        actual = []
      }
      actual.push(x)
    }
    if (actual.length >= 2) grupos.push(actual)
  }
  return grupos.map(g => ({
    base: g[0].base,
    items: [...g].sort((a, b) => ordenTalla(a.talla) - ordenTalla(b.talla))
  }))
}

// ---------- Subcategoría y edad (deducidas del nombre) ----------

const contiene = (texto, ...palabras) => palabras.some(p => new RegExp(`(^|[^A-Z])${p}([^A-Z]|$)`).test(texto))

export function deducirSubcategoria(categoria, nombre) {
  const n = sinTildes(nombre).toUpperCase()
  switch (categoria) {
    case 'perros':
    case 'gatos':
      if (contiene(n, 'ARNES', 'COLLAR', 'CUERDA', 'PECHERA', 'CORREA')) return 'Accesorios'
      if (contiene(n, 'REPELENTE', 'ROCIADOR', 'LECHE')) return 'Cuidado y suplementos'
      if (contiene(n, 'LATA', 'SOBRE', 'POTE', 'COMPOTA', 'PATE', 'DRINK', 'BROTH', 'STEW', 'BISQUE') && !contiene(n, 'SNACK', 'GALLETAS?')) return 'Alimento húmedo'
      if (contiene(n, 'ALIMENTO', 'ANIMAL PLANET ADULT DOG') || (/\d+(,\d+)?\s*KG/.test(n) && !contiene(n, 'SNACK', 'BACON'))) return 'Alimento seco'
      return 'Snacks y premios'
    case 'otras-mascotas':
      if (contiene(n, 'SNACK')) return 'Snacks'
      if (contiene(n, 'VIRUTA', 'PELET')) return 'Sustrato e higiene'
      return 'Alimento'
    case 'granel':
      if (contiene(n, 'GATO', 'GATITOS?', 'CAT', 'KITTEN', 'GATTI', 'FELINES?', 'WHISKAS')) return 'Gato'
      if (contiene(n, 'CONEJOS?')) return 'Otras mascotas'
      return 'Perro'
    case 'accesorios':
      if (contiene(n, 'JUGUETES?', 'JUGUETITOS', 'PELOTA', 'CATNIP', 'YERBA GATERA', 'TOYCAT')) return 'Juguetes'
      if (contiene(n, 'RASCADOR')) return 'Rascadores'
      if (contiene(n, 'COLLAR', 'CORREA', 'ARNES', 'PECHERA', 'TIRADOR', 'BOZAL', 'PLACAS')) return 'Collares, correas y arneses'
      if (contiene(n, 'PLATO', 'FUENTE', 'FILTRO', 'MAMADERA', 'CONTENEDOR')) return 'Platos y fuentes'
      if (contiene(n, 'CAMA', 'COJIN', 'FRAZADA', 'MANTA', 'HAMACA', 'SACO DE DORMIR', 'CASA')) return 'Camas y descanso'
      if (contiene(n, 'TRANSPORTADOR', 'MOCHILA', 'JAULA', 'CANGURO')) return 'Transporte'
      if (contiene(n, 'ARENERO', 'PALA', 'BANDEJA', 'BOLSA', 'BOLSITAS', 'ALFOMBRA', 'EDUCADOR', 'ENTRENADOR', 'PUPPY TRAINING')) return 'Areneros e higiene'
      if (contiene(n, 'CEPILLO', 'REMOVEDOR', 'ROLLER', 'RODILLO', 'GUANTES?', 'CORTAUNAS', 'TIJERA', 'LIMA', 'SET DENTAL')) return 'Peluquería y cuidado'
      return 'Varios'
    case 'arena':
      if (contiene(n, 'CRISTAL', 'CRYSTAL', 'CRISTALES', 'CRISTALS')) return 'Cristales (sílica)'
      if (contiene(n, 'ECOLOGICA', 'PELET')) return 'Ecológica'
      return 'Aglutinante'
    case 'ropa':
      if (contiene(n, 'CHAQUETA', 'PARKA')) return 'Chaquetas y parkas'
      if (contiene(n, 'CHALECO')) return 'Chalecos'
      if (contiene(n, 'BANDANA')) return 'Bandanas'
      return 'Bodys y otros'
    case 'salud-higiene':
      if (contiene(n, 'ANTIPARASITARIO')) return 'Antiparasitarios'
      if (contiene(n, 'SUPLEMENTO', 'PROBIOTICOS', 'JARABE', 'LECHE', 'SUSTITUTO')) return 'Vitaminas y suplementos'
      if (contiene(n, 'CALMING', 'FEROMONAS')) return 'Calmantes y feromonas'
      if (contiene(n, 'SHAMPOO', 'ACONDICIONADOR', 'COLONIA')) return 'Shampoo y colonias'
      if (contiene(n, 'DENTAL', 'DENTALIFE', 'PASTA DENTAL')) return 'Higiene dental'
      if (contiene(n, 'PANAL', 'SABANILLAS', 'TOALLITAS')) return 'Pañales, sabanillas y toallitas'
      return 'Cuidado y recuperación'
    default:
      return 'Varios'
  }
}

export function deducirEdad(categoria, nombre) {
  if (!['perros', 'gatos', 'granel'].includes(categoria)) return null
  const n = sinTildes(nombre).toUpperCase()
  if (contiene(n, 'CACHORROS?', 'GATITOS?', 'KITTEN', 'PUPPY')) return 'Cachorro o gatito'
  if (contiene(n, 'SENIOR') || /\+\s*7/.test(n)) return 'Senior'
  if (contiene(n, 'ADULTOS?', 'ADULT')) return 'Adulto'
  return null
}

// ---------- Nombre público ----------

export function nombreGranel(nombre) {
  const sinMarcador = String(nombre)
    .replace(/\(\s*GRANEL\s*\)/i, '')
    .replace(/^\s*GRANEL\s+/i, '')
    .replace(/^\s*ALIMENTO\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return formatoTitulo(sinMarcador) + ' a granel'
}

// ¿El nombre ya menciona la marca? (ignora mayúsculas, tildes y espacios)
export function nombreIncluyeMarca(nombre, marca) {
  if (!marca || marca === 'Genérico') return true
  const n = slug(nombre).replace(/-/g, '')
  const partes = slug(marca).split('-')
  const resto = partes.slice(1).join('')
  return n.includes(partes.join('')) || (partes[0].length >= 4 && n.includes(partes[0])) || (resto.length >= 4 && n.includes(resto))
}

// ---------- Seguridad: lo que nunca se publica ----------

// productos.json: solo estos campos (nunca costo, proveedor ni unidades por sucursal)
export const CAMPOS_PUBLICOS = new Set([
  'id', 'sku', 'nombre', 'marca', 'categoria', 'subcategoria', 'edad', 'precio', 'granel',
  'imagen', 'tallas', 'talla', 'nuevo'
])

// ---------- SKU nuevos (convención de la planilla: CATEGORIA-MARCA-NNN) ----------

export const PREFIJO_SKU = {
  perros: 'PER', gatos: 'GAT', 'otras-mascotas': 'OTR', granel: 'GRA', accesorios: 'ACC',
  arena: 'ACC', ropa: 'ACC', 'salud-higiene': 'SAL'
}

// abreviaturas: Map(marcaNormalizada → 'ABCD') aprendido de los SKU existentes
// usados: Set de SKU ya ocupados (se le agrega el nuevo)
export function generarSku(categoria, fabricante, abreviaturas, usados) {
  const prefijo = PREFIJO_SKU[categoria] || 'SINCAT'
  const marca = slug(fabricante || '')
  let abrev
  if (!marca || /^gen[eé]ric/.test(marca)) abrev = 'GEN'
  else if (abreviaturas.has(marca)) abrev = abreviaturas.get(marca)
  else {
    const letras = marca.replace(/[^a-z]/g, '').toUpperCase()
    const ocupadas = new Set(abreviaturas.values())
    const opciones = [letras.slice(0, 4), letras.slice(0, 3) + letras.slice(-1), letras.slice(0, 2) + letras.slice(-2)]
    abrev = opciones.find(o => o.length === 4 && !ocupadas.has(o)) || (letras.slice(0, 3) + 'X')
    abreviaturas.set(marca, abrev)
  }
  let n = 1
  for (const s of usados) {
    const m = s.match(new RegExp(`^${prefijo}-${abrev}-(\\d+)$`))
    if (m) n = Math.max(n, Number(m[1]) + 1)
  }
  const sku = `${prefijo}-${abrev}-${String(n).padStart(3, '0')}`
  usados.add(sku)
  return sku
}
