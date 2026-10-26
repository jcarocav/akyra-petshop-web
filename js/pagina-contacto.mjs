// ============================================================
// FORMULARIO DE CONTACTO — valida, protege contra spam (campo trampa
// y límite de envíos) y abre el correo del visitante con el mensaje
// listo para enviar a la tienda (el sitio no tiene servidor propio).
// ============================================================
import { CONFIG } from './datos.mjs'
import { $, $$, anunciar, h, permitirEnvio, textoSeguro } from './utilidades.mjs'

const form = $('#form-contacto')

const REGLAS = [
  { id: 'contacto-nombre', validar: v => v.length >= 2, mensaje: 'Escribe tu nombre.' },
  { id: 'contacto-email', validar: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), mensaje: 'Escribe un correo válido, por ejemplo nombre@correo.cl.' },
  { id: 'contacto-telefono', validar: v => !v || (/^\+?[\d\s-]{8,16}$/.test(v) && v.replace(/\D/g, '').length >= 8), mensaje: 'El teléfono no es válido (puedes dejarlo vacío).' },
  { id: 'contacto-mensaje', validar: v => v.length >= 10, mensaje: 'Cuéntanos qué necesitas (al menos 10 caracteres).' }
]

function valor(id, max, multilinea = false) {
  return textoSeguro($(`#${id}`).value, max, { multilinea })
}

function limpiar() {
  $$('[aria-invalid="true"]', form).forEach(el => el.removeAttribute('aria-invalid'))
  $$('.campo__error', form).forEach(el => { el.hidden = true; el.textContent = '' })
  $('#contacto-errores').hidden = true
}

function mostrarErrores(errores) {
  for (const r of errores) {
    $(`#${r.id}`).setAttribute('aria-invalid', 'true')
    const msg = $(`#${r.id}-error`)
    msg.textContent = r.mensaje
    msg.hidden = false
  }
  const resumen = $('#contacto-errores')
  resumen.replaceChildren(
    h('p', { text: errores.length === 1 ? 'Revisa 1 campo:' : `Revisa ${errores.length} campos:` }),
    h('ul', {}, errores.map(r => h('li', {}, h('a', { href: `#${r.id}`, text: r.mensaje }))))
  )
  resumen.hidden = false
  anunciar(`No se pudo enviar. ${errores.map(r => r.mensaje).join(' ')}`, { urgente: true })
  $(`#${errores[0].id}`).focus()
}

form?.addEventListener('submit', e => {
  e.preventDefault()
  limpiar()
  if ($('#contacto-sitio-web').value) return // trampa para robots
  const datos = {
    asunto: valor('contacto-asunto', 40),
    nombre: valor('contacto-nombre', 80),
    email: valor('contacto-email', 120),
    telefono: valor('contacto-telefono', 20),
    mensaje: valor('contacto-mensaje', 1000, true)
  }
  const errores = REGLAS.filter(r => !r.validar(datos[r.id.replace('contacto-', '')]))
  if (errores.length) return mostrarErrores(errores)

  const permiso = permitirEnvio('akyra_envios_contacto', { maximo: 3, separacionMs: 15000 })
  if (!permiso.ok) {
    const resumen = $('#contacto-errores')
    resumen.replaceChildren(h('p', { text: permiso.motivo }))
    resumen.hidden = false
    anunciar(permiso.motivo, { urgente: true })
    return
  }
  const asunto = `[Sitio web] ${datos.asunto} — ${datos.nombre}`
  const cuerpo = `Asunto: ${datos.asunto}\nNombre: ${datos.nombre}\nCorreo: ${datos.email}\nTeléfono: ${datos.telefono || '(no indicado)'}\n\nMensaje:\n${datos.mensaje}`
  const enlace = `mailto:${CONFIG.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
  $('#contacto-listo').hidden = false
  $('#contacto-listo-enlace').href = enlace
  $('#contacto-listo').focus()
  window.location.href = enlace
})

$('#contacto-errores')?.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]')
  if (!a) return
  e.preventDefault()
  $(a.getAttribute('href'))?.focus()
})
