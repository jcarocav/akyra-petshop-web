// Carga apps-script/Lector.js (el mismo código que corre en Google Apps Script)
// para usarlo desde Node: GitHub Action y pruebas.
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const contexto = { module: { exports: {} }, console }
vm.runInNewContext(readFileSync(join(RAIZ, 'apps-script', 'Lector.js'), 'utf8'), contexto)
export const {
  COLUMNAS_POR_DEFECTO, lectorNumero, lectorCodigo, lectorDetectarColumnas,
  lectorLeerReporte, lectorAplicarReporte, lectorParsearCsv
} = contexto.module.exports
