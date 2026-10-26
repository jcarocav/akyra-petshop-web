// ============================================================
// ¿Este título de otra tienda es EXACTAMENTE nuestro producto?
// Comparación estricta: misma marca, mismo tamaño, mismos sabores,
// misma etapa de vida, mismas variantes (urinary, castrado, raza
// pequeña, etc.) y mismo formato (lata / sobre / pack). Ante la duda,
// no acepta: es preferible "no encontrada" a una foto parecida.
// ============================================================

const SINONIMOS = [
  [/\bchicken\b/g, 'pollo'], [/\bbeef\b/g, 'carne'], [/\bvacuno\b/g, 'carne'], [/\bres\b/g, 'carne'],
  [/\btuna\b/g, 'atun'], [/\blamb\b/g, 'cordero'], [/\bduck\b/g, 'pato'], [/\bturkey\b/g, 'pavo'],
  [/\bfish\b/g, 'pescado'], [/\bpork\b/g, 'cerdo'], [/\bpuerco\b/g, 'cerdo'], [/\brabbit\b/g, 'conejo'],
  [/\bshrimp\b/g, 'camaron'], [/\bcrab\b/g, 'cangrejo'], [/\bscallops?\b/g, 'ostion'], [/\bherring\b/g, 'arenque'],
  [/\bliver\b/g, 'higado'], [/\bkitten\b/g, 'gatito'], [/\bgatitos\b/g, 'gatito'], [/\bpuppy\b/g, 'cachorro'],
  [/\bcachorros\b/g, 'cachorro'], [/\bjunior\b/g, 'cachorro'], [/\badult[oa]?s?\b/g, 'adulto'],
  [/\bmature\b/g, 'senior'], [/\bsterili[sz]ed\b/g, 'esterilizado'], [/\besteriliz\w*\b/g, 'esterilizado'],
  [/\bcastrad[oa]s?\b/g, 'esterilizado'], [/\bneutered\b/g, 'esterilizado'], [/\bhypoallergenic\b/g, 'hipoalergenico'],
  [/\bhipoalargenico\b/g, 'hipoalergenico'], [/\bgastro\s*intestinal\b/g, 'gastrointestinal'], [/\bgastro\b/g, 'gastrointestinal'],
  [/\bsmall\s*breed\b/g, 'raza-pequena'], [/\braza\s*pequena\b/g, 'raza-pequena'], [/\brazas\s*pequenas\b/g, 'raza-pequena'],
  [/\bmini\b/g, 'raza-pequena'], [/\bmedium\s*breed\b/g, 'raza-mediana'], [/\braza\s*mediana\b/g, 'raza-mediana'],
  [/\brazas\s*medianas\b/g, 'raza-mediana'], [/\blarge\s*breed\b/g, 'raza-grande'], [/\braza\s*grande\b/g, 'raza-grande'],
  [/\brazas\s*grandes?\b/g, 'raza-grande'], [/\bpro\s*plan\b/g, 'proplan'], [/\bvet\s*life\b/g, 'vetlife'],
  [/\btop\s*k\s*9\b/g, 'topk9'], [/\bn\s*&\s*d\b/g, 'nyd'], [/\bn\s*y\s*d\b/g, 'nyd'], [/\bfit\s*formula\b/g, 'fitformula'],
  [/\bmaster\s*dog\b/g, 'masterdog'], [/\bmaster\s*cat\b/g, 'mastercat'], [/\bcat\s*chow\b/g, 'catchow'],
  [/\bdog\s*chow\b/g, 'dogchow'], [/\bfancy\s*feast\b/g, 'fancyfeast'], [/\broyal\s*canin+\b/g, 'royalcanin'],
  [/\bmarben\s*pets?\b/g, 'marbenpets'], [/\btasty\s*farm\b/g, 'tastyfarm'], [/\banimal\s*planet\b/g, 'animalplanet'],
  [/\bpouch\b/g, 'sobre'], [/\bcan\b/g, 'lata'], [/\btarro\b/g, 'lata'], [/\bindoor\b/g, 'indoor'],
  [/\bobesity\b/g, 'light'], [/\bweight\b/g, 'light'], [/\bhairball\b/g, 'bolas-pelo'], [/\bbolas\s*de\s*pelo\b/g, 'bolas-pelo']
]

const SABORES = new Set(['pollo', 'carne', 'atun', 'salmon', 'cordero', 'pato', 'pavo', 'pescado', 'cerdo', 'conejo',
  'camaron', 'cangrejo', 'ostion', 'sardina', 'trucha', 'ternera', 'venado', 'arenque', 'higado', 'menta', 'leche',
  'arroz', 'verduras', 'vegetales', 'lenguado', 'granada', 'calabaza', 'quinoa', 'berries', 'manzana', 'lavanda',
  'limon', 'rosa', 'rosas', 'talco', 'cafe', 'moka', 'frutilla', 'natural', 'avena', 'miel', 'camomilla'])
const ETAPAS = new Set(['cachorro', 'gatito', 'adulto', 'senior'])
const VARIANTES = new Set(['urinary', 'renal', 'gastrointestinal', 'hipoalergenico', 'light', 'esterilizado', 'indoor',
  'raza-pequena', 'raza-mediana', 'raza-grande', 'sensitive', 'bolas-pelo', 'dental', 'exigent', 'recovery', 'diet',
  'nourish', 'grain', 'perro', 'gato'])
const FORMATOS = new Set(['lata', 'sobre', 'pack', 'caja', 'balde', 'display', 'tubo', 'tubos', 'compota', 'pate', 'mousse', 'galleta', 'galletas', 'arena', 'shampoo'])
const VACIAS = new Set(['de', 'del', 'con', 'y', 'para', 'el', 'la', 'los', 'las', 'en', 'sabor', 'receta', 'alimento',
  'a', 'x', 'kg', 'g', 'ml', 'l', 'gr', 'uds', 'ud', 'unidades', 'unidad', 'un', 'una', 'por', 'mas', 'plus', 'sabores'])

export function normalizar(texto) {
  let t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  t = t.replace(/[(),.;:!¡¿?"'/+]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ')
  // "1,5 kg" ya quedó "1 5 kg": se vuelve a unir el decimal
  t = t.replace(/(\d) (\d{1,3}) ?(kg|kgs|g|gr|grs|ml|l|lt|lts)\b/g, '$1.$2 $3')
  for (const [re, rep] of SINONIMOS) t = t.replace(re, rep)
  return t.trim()
}

// Tamaños en gramos o mililitros: "1.5 kg" → 1500, "85g" → 85, "7,6 lt" → 7600 (ml)
export function tamanos(textoNormalizado) {
  const out = []
  const re = /(\d+(?:\.\d+)?)\s?(kg|kgs|kilos?|g|gr|grs|gramos|ml|l|lt|lts|litros?)\b/g
  let m
  while ((m = re.exec(textoNormalizado))) {
    const n = Number(m[1])
    const u = m[2]
    if (u.startsWith('k')) out.push({ tipo: 'peso', valor: Math.round(n * 1000) })
    else if (u.startsWith('g')) out.push({ tipo: 'peso', valor: Math.round(n) })
    else if (u === 'ml') out.push({ tipo: 'vol', valor: Math.round(n) })
    else out.push({ tipo: 'vol', valor: Math.round(n * 1000) })
  }
  return out
}

function cantidades(t) {
  const out = new Set()
  const re = /\b(\d+)\s?(uds|ud|unidades|un|tubos|tubitos|sobres|pcs|piezas|sticks|x)\b|\bx\s?(\d+)\b|\bpack\s?(?:de\s)?(\d+)/g
  let m
  while ((m = re.exec(t))) out.add(Number(m[1] || m[3] || m[4]))
  return out
}

const palabras = t => t.split(' ').filter(Boolean)

const ALIAS_MARCA = {
  inaba: ['churu'],
  naturalistic: ['cremi'],
  marbenpets: ['tastyfarm', 'wonder', 'healthy', 'cats snack'],
  fitformula: ['fit']
}

export function evaluarCoincidencia(item, tituloCandidato) {
  const nuestro = normalizar(item.nombreExcel)
  const otro = normalizar(tituloCandidato)
  const pn = new Set(palabras(nuestro))
  const po = new Set(palabras(otro))
  const rechazo = motivo => ({ acepta: false, puntaje: 0, motivo })

  // 1. Marca (o su línea conocida: Churu es de Inaba, Cremi de Naturalistic...)
  const marca = normalizar(item.marca || '')
  const tokensMarca = palabras(marca).filter(w => w.length >= 3 && w !== 'purina' && w !== 'mascota' && w !== 'pets' && w !== 'pet')
    .concat(ALIAS_MARCA[marca] || [])
  // Todas las palabras de la marca deben estar como palabras completas (o un alias conocido)
  const marcaOk = palabras(marca).filter(w => w.length >= 3 && !['purina', 'mascota', 'pets', 'pet'].includes(w)).every(w => po.has(w)) ||
    (ALIAS_MARCA[marca] || []).some(a => otro.includes(a))
  if (tokensMarca.length && !marcaOk) return rechazo('marca distinta')

  // 2. Tamaño
  const tn = tamanos(nuestro)
  const to = tamanos(otro)
  // Números sueltos sin unidad en nuestro nombre ("URINARY S/O 7,5"): no se puede confirmar el tamaño
  const numerosSueltos = palabras(nuestro.replace(/(\d+(?:\.\d+)?)\s?(kg|kgs|kilos?|g|gr|grs|gramos|ml|l|lt|lts|litros?|uds|ud|unidades|un|tubos|tubitos|sobres|pcs|piezas|sticks|x)/g, '')).filter(w => /^\d+(\.\d+)?$/.test(w))
  if (!tn.length && numerosSueltos.length) return rechazo('tamaño sin confirmar')
  // Tallas sueltas en el título de la otra tienda (S, M, L…) que no están en el nuestro
  const tallasOtro = [...po].filter(w => ['s', 'm', 'l', 'xl', 'xs', 'xxl'].includes(w))
  if (tallasOtro.some(t => !pn.has(t))) return rechazo('talla distinta')
  // Especie: si nuestro nombre no la dice, se toma de la categoría
  const especie = item.categoria === 'gatos' ? 'gato' : item.categoria === 'perros' ? 'perro' : null
  if (especie && !pn.has('perro') && !pn.has('gato')) {
    const contraria = especie === 'gato' ? 'perro' : 'gato'
    if (po.has(contraria) || po.has(contraria + 's')) return rechazo('especie distinta')
  }
  if (tn.length) {
    if (!to.length) return rechazo('sin tamaño en el candidato')
    const ok = tn.every(a => to.some(b => b.tipo === a.tipo && Math.abs(b.valor - a.valor) <= Math.max(1, a.valor * 0.01)))
    if (!ok) return rechazo('tamaño distinto')
  }

  // 3. Cantidad de unidades (packs)
  const cn = cantidades(nuestro)
  const co = cantidades(otro)
  if (co.size && ![...co].every(n => cn.has(n))) return rechazo('pack o cantidad distinta')
  if (cn.size && ![...cn].every(n => co.has(n))) return rechazo('cantidad no confirmada')

  // 4. Sabores, etapas, variantes y formato: deben coincidir en ambos sentidos
  for (const [nombre, conjunto] of [['sabor', SABORES], ['variante', VARIANTES], ['formato', FORMATOS]]) {
    const a = [...pn].filter(w => conjunto.has(w))
    const b = [...po].filter(w => conjunto.has(w))
    if (nombre === 'variante') {
      // "perro"/"gato" pueden faltar en el título de la otra tienda, pero no contradecirse
      const conflictoEspecie = (pn.has('perro') && po.has('gato') && !po.has('perro')) || (pn.has('gato') && po.has('perro') && !po.has('gato'))
      if (conflictoEspecie) return rechazo('especie distinta')
      const sinEspecie = x => x.filter(w => w !== 'perro' && w !== 'gato')
      if (sinEspecie(a).some(w => !po.has(w)) || sinEspecie(b).some(w => !pn.has(w))) return rechazo('variante distinta')
      continue
    }
    if (a.some(w => !po.has(w)) || b.some(w => !pn.has(w))) return rechazo(`${nombre} distinto`)
  }
  const en = [...pn].filter(w => ETAPAS.has(w))
  const eo = [...po].filter(w => ETAPAS.has(w))
  if (en.some(w => !po.has(w))) return rechazo('etapa distinta')
  if (eo.some(w => !pn.has(w) && !(w === 'adulto' && en.length === 0))) return rechazo('etapa distinta')

  // 5. Resto de palabras distintivas: la mayoría de las nuestras deben estar
  const distintivas = [...pn].filter(w => !VACIAS.has(w) && !/^\d/.test(w) && w.length > 2 &&
    !['snack', 'galletas', 'galleta', 'sobre', 'lata', 'caja', 'balde', 'pote', 'compota'].includes(w))
  if (!distintivas.length) return rechazo('nombre sin palabras distintivas')
  // Todas nuestras palabras distintivas deben estar (singular/plural da igual);
  // con nombres largos (6 o más) se tolera que falte una.
  const raiz = w => w.replace(/(es|s)$/, '')
  const raicesOtro = new Set([...po].map(raiz))
  const presentes = distintivas.filter(w => po.has(w) || raicesOtro.has(raiz(w)))
  const faltan = distintivas.length - presentes.length
  const cobertura = presentes.length / distintivas.length
  if (faltan > (distintivas.length >= 6 ? 1 : 0)) return rechazo(`faltan palabras (${Math.round(cobertura * 100)}%)`)

  return { acepta: true, puntaje: cobertura + (tn.length ? 0.5 : 0), motivo: 'ok' }
}
