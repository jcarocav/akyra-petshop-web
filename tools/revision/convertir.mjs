// ============================================================
// Revisión → ajustes del catálogo. Funciones puras: las usan el servidor, la página de la herramienta
// (en el navegador) y las pruebas.
//
// cambiosAAjustes(cambios) arma el mismo formato de tools/catalogo/ajustes-catalogo.json:
//   excluidos  ← "Eliminar de la web"
//   modificados← nombre, marca, descripción, categoría, subcategoría, precio (por talla), disponibilidad, foto
//   agregados  ← productos nuevos
// La foto sacada en la revisión queda como assets/productos/<SKU>.webp (tipo exacta = "propia").
// ============================================================

// "12345", "12.345", "$12.345", " $ 12.345 " → 12345. Solo enteros positivos; si no, null.
export function leerPrecio(texto) {
  if (typeof texto === 'number') return Number.isInteger(texto) && texto > 0 ? texto : null
  const t = String(texto ?? '').trim().replace(/^\$\s*/, '').replace(/\s/g, '')
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(t)) return null
  const n = Number(t.replace(/\./g, ''))
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export function formatoPrecio(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ¿Cambio grande? (sube o baja más de 50 %): se pide confirmar, sin bloquear.
export function cambioGrande(antes, ahora) {
  if (typeof antes !== 'number' || antes <= 0 || typeof ahora !== 'number') return false
  return Math.abs(ahora - antes) / antes > 0.5
}

const valor = (c, campo) => c?.[campo]?.valor ?? null

export function rutaFotoSitio(sku) {
  return `assets/productos/${sku}.webp`
}

// incluirNuevosEliminados: la herramienta sigue mostrando un producto nuevo marcado "Eliminar" (para poder deshacerlo)
export function cambiosAAjustes(cambios = {}, { incluirNuevosEliminados = false } = {}) {
  const ajustes = { version: 1, excluidos: {}, modificados: {}, agregados: [] }
  for (const [sku, c] of Object.entries(cambios)) {
    if (valor(c, 'nuevo')) {
      if (valor(c, 'eliminar')) {
        if (!incluirNuevosEliminados) continue
        ajustes.excluidos[sku] = { motivo: valor(c, 'eliminar').motivo || '' }
      }
      const nuevo = {
        sku, codigo: valor(c, 'codigo') || null, nombre: valor(c, 'nombre') || '', marca: valor(c, 'marca') || 'Genérico',
        categoria: valor(c, 'categoria') || 'accesorios', subcategoria: valor(c, 'subcategoria') || undefined,
        descripcion: valor(c, 'descripcion') || undefined, disponibilidad: valor(c, 'disponibilidad') || 'consultar'
      }
      if (valor(c, 'granel')) nuevo.granel = true
      const tallas = valor(c, 'tallas')
      if (Array.isArray(tallas) && tallas.length) {
        nuevo.tallas = tallas.map(t => ({
          talla: String(t.talla), precio: valor(c, `precio@${t.talla}`) ?? leerPrecio(t.precio),
          disponibilidad: valor(c, `disponibilidad@${t.talla}`) || t.disponibilidad || nuevo.disponibilidad
        }))
      } else nuevo.precio = valor(c, 'precio')
      if (valor(c, 'foto')) { nuevo.imagen = rutaFotoSitio(sku); nuevo.imagenTipo = 'exacta' }
      ajustes.agregados.push(JSON.parse(JSON.stringify(nuevo)))
      continue
    }
    const eliminar = valor(c, 'eliminar')
    if (eliminar) { ajustes.excluidos[sku] = { motivo: eliminar.motivo || '' }; continue }
    const m = {}
    for (const campo of ['nombre', 'marca', 'descripcion', 'categoria', 'subcategoria', 'precio', 'disponibilidad']) {
      const v = valor(c, campo)
      if (v !== null && v !== '') m[campo] = v
    }
    for (const [campo, dato] of Object.entries(c)) {
      const [base, talla] = campo.split('@')
      if (!talla || !['precio', 'disponibilidad'].includes(base) || dato?.valor == null) continue
      m.tallas = m.tallas || {}
      m.tallas[talla] = { ...m.tallas[talla], [base]: dato.valor }
    }
    if (typeof valor(c, 'granel') === 'boolean') m.granel = valor(c, 'granel')
    if (valor(c, 'foto')) { m.imagen = rutaFotoSitio(sku); m.imagenTipo = 'exacta' }
    if (Object.keys(m).length) ajustes.modificados[sku] = m
  }
  return ajustes
}

// Junta los ajustes que ya están en el repositorio con los de la revisión (la revisión gana).
export function juntarAjustes(base, extra) {
  const salida = { version: 1, excluidos: { ...base?.excluidos }, modificados: { ...base?.modificados }, agregados: [...(base?.agregados || [])] }
  Object.assign(salida.excluidos, extra.excluidos)
  for (const [sku, m] of Object.entries(extra.modificados)) {
    const previo = salida.modificados[sku] || {}
    salida.modificados[sku] = { ...previo, ...m, ...(previo.tallas || m.tallas ? { tallas: { ...previo.tallas, ...m.tallas } } : {}) }
  }
  const skus = new Set(extra.agregados.map(a => a.sku))
  salida.agregados = [...salida.agregados.filter(a => !skus.has(a.sku)), ...extra.agregados]
  return salida
}

// Marcas que muestra la card de la herramienta (texto, no solo color)
export function marcasDeCambios(c = {}) {
  const tiene = campo => c[campo]?.valor != null
  const campos = Object.keys(c)
  const marcas = []
  if (tiene('nuevo')) marcas.push('Nuevo')
  if (tiene('eliminar')) marcas.push('Eliminar')
  if (campos.some(k => k.split('@')[0] === 'precio' && c[k]?.valor != null) && !tiene('nuevo')) marcas.push('Precio cambiado')
  if (tiene('foto')) marcas.push('Foto nueva')
  if (!tiene('nuevo') && campos.some(k => /^(nombre|marca|descripcion|categoria|subcategoria|disponibilidad|nota)(@|$)/.test(k) && c[k]?.valor != null)) marcas.push('Modificar')
  if (tiene('revisado') && marcas.length === 0) marcas.push('OK')
  return marcas
}
