// ============================================================
// Diálogos accesibles (carrito, filtros en celular, aviso de
// privacidad): atrapan el foco mientras están abiertos (el resto de
// la página queda "inert"), se cierran con Esc y devuelven el foco al
// botón que los abrió.
// ============================================================

const abiertos = []

// Todo lo que no es el panel (ni lo contiene): los hermanos del panel y
// de cada uno de sus ancestros, hasta <body>.
function fondoDeLaPagina(panel) {
  const resultado = []
  let nodo = panel
  while (nodo && nodo !== document.body) {
    const padre = nodo.parentElement
    if (!padre) break
    for (const hermano of padre.children) {
      if (hermano !== nodo && hermano.tagName !== 'SCRIPT' && !hermano.matches('[data-siempre-activo]')) resultado.push(hermano)
    }
    nodo = padre
  }
  return resultado
}

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function enfocables(raiz) {
  return [...raiz.querySelectorAll(ENFOCABLES)].filter(el => !el.closest('[hidden]') && !el.closest('[inert]') && el.offsetParent !== null)
}

export function crearDialogo(panel, { fondo = null, alAbrir = () => {}, alCerrar = () => {}, claseAbierto = 'abierto', cerrarConEsc = true, usarHidden = true } = {}) {
  let quienAbrio = null
  let inertes = []

  function onKeydown(e) {
    if (abiertos[abiertos.length - 1] !== api) return
    if (e.key === 'Escape' && cerrarConEsc) {
      e.preventDefault()
      cerrar()
      return
    }
    if (e.key !== 'Tab') return
    const lista = enfocables(panel)
    if (!lista.length) { e.preventDefault(); panel.focus(); return }
    const primero = lista[0]
    const ultimo = lista[lista.length - 1]
    if (e.shiftKey && (document.activeElement === primero || !panel.contains(document.activeElement))) {
      e.preventDefault(); ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primero.focus()
    }
  }

  function abrir(origen = document.activeElement, { enfocar = null } = {}) {
    if (api.abierto) return
    quienAbrio = origen instanceof HTMLElement ? origen : null
    if (usarHidden) panel.hidden = false
    if (fondo) fondo.hidden = false
    // reflow para que la transición de entrada se vea
    void panel.offsetWidth
    panel.classList.add(claseAbierto)
    fondo?.classList.add(claseAbierto)
    inertes = fondoDeLaPagina(panel).filter(el => el !== fondo && !el.inert)
    inertes.forEach(el => { el.inert = true })
    document.documentElement.classList.add('sin-scroll')
    api.abierto = true
    abiertos.push(api)
    document.addEventListener('keydown', onKeydown)
    alAbrir()
    const destino = enfocar || panel.querySelector('[autofocus]') || panel.querySelector('[data-enfoque-inicial]') || enfocables(panel)[0] || panel
    destino.focus({ preventScroll: true })
  }

  function cerrar({ devolverFoco = true } = {}) {
    if (!api.abierto) return
    panel.classList.remove(claseAbierto)
    fondo?.classList.remove(claseAbierto)
    inertes.forEach(el => { el.inert = false })
    inertes = []
    api.abierto = false
    abiertos.splice(abiertos.indexOf(api), 1)
    if (!abiertos.length) document.documentElement.classList.remove('sin-scroll')
    document.removeEventListener('keydown', onKeydown)
    const ocultar = () => { if (!api.abierto) { if (usarHidden) panel.hidden = true; if (fondo) fondo.hidden = true } }
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducido || getComputedStyle(panel).transitionDuration === '0s') ocultar()
    else setTimeout(ocultar, 260)
    alCerrar()
    if (devolverFoco && quienAbrio && document.contains(quienAbrio)) quienAbrio.focus({ preventScroll: true })
  }

  fondo?.addEventListener('click', () => cerrar())
  const api = { abrir, cerrar, abierto: false, panel }
  return api
}
