import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { openKitchenPrintPreview } from '../src/utils/kitchenPrint.ts'

function previewFor(confirm) {
  let html = ''
  let click
  let prints = 0
  const button = { addEventListener(_event, handler) { click = handler }, disabled: false, textContent: '' }
  const status = { textContent: '' }
  const preview = {
    document: {
      open() {}, write(value) { html = value }, close() {},
      getElementById(id) { return id === 'kitchen-print-button' ? button : status },
    },
    focus() {},
    print() { prints++ },
  }
  openKitchenPrintPreview(preview, {
    pedidoId: 1,
    esComandaAdicional: true,
    productos: [{ producto: 'Pan', cantidad: 2 }],
  }, confirm)
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  runInNewContext(script, { window: preview, document: preview.document })
  return { html, button, status, click: async () => { click(); await new Promise(setImmediate) }, prints: () => prints }
}

test('confirma una sola vez y permite reabrir el selector sin reenviar', async () => {
  let sends = 0
  const preview = previewFor(async () => { sends++; return { ok: true, browserPrint: true } })
  assert.match(preview.html, /COMANDA ADICIONAL/)
  assert.match(preview.html, /2x/)
  assert.match(preview.html, /Pan/)
  await preview.click()
  await preview.click()
  assert.equal(sends, 1)
  assert.equal(preview.prints(), 2)
  assert.match(preview.status.textContent, /cancelaste/)
})

test('no abre el selector cuando el backend anterior encola la comanda', async () => {
  let sends = 0
  const preview = previewFor(async () => { sends++; return { ok: true, browserPrint: false, message: 'En cola' } })
  await preview.click()
  assert.equal(preview.prints(), 0)
  assert.equal(preview.button.disabled, true)
  assert.equal(preview.status.textContent, 'En cola')
  assert.equal(sends, 1)
})

test('un envio fallido no imprime y permite reintentar', async () => {
  const preview = previewFor(async () => ({ ok: false, message: 'Error de envío' }))
  await preview.click()
  assert.equal(preview.prints(), 0)
  assert.equal(preview.button.disabled, false)
  assert.equal(preview.status.textContent, 'Error de envío')
})
