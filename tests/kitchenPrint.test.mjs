import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openKitchenPrintPreview } from '../src/utils/kitchenPrint.ts'

test('la vista previa confirma la cola sin imprimir una segunda comanda desde el navegador', () => {
  let html = ''
  const preview = {
    document: { open() {}, write(value) { html = value }, close() {} },
    focus() {},
  }
  openKitchenPrintPreview(preview, {
    pedidoId: 1,
    esComandaAdicional: true,
    productos: [{ producto: 'Pan', cantidad: 2 }],
  }, async () => ({ ok: true }))

  assert.match(html, /COMANDA ADICIONAL/)
  assert.match(html, /2x/)
  assert.match(html, /Pan/)
  assert.match(html, /cola de impresión/)
  assert.doesNotMatch(html, /window\.print\(\)/)
})
