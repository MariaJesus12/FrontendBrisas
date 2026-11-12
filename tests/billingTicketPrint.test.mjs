import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateBillingTicketHtml, printBillingTicket } from '../src/utils/billingTicketPrint.ts'

const ticket = { items: [{ cantidad: 1, descripcion: 'Pan', precio: 500 }], subtotal: 500, total: 500 }

test('el recibo abre el selector y conserva un boton para reintentar', () => {
  let html = ''
  let prints = 0
  const popup = {
    document: { open() {}, write(value) { html = value }, close() {} },
    focus() {},
    print() { prints++ },
  }
  printBillingTicket(popup, ticket)
  assert.equal(prints, 1)
  assert.match(html, /id="billing-print-button"/)
  assert.match(html, /@media print/)
  assert.match(generateBillingTicketHtml(ticket), /Pan/)
})

test('un error al abrir el selector deja el recibo disponible para reintentar', () => {
  const status = { textContent: '' }
  const popup = {
    document: { open() {}, write() {}, close() {}, getElementById() { return status } },
    focus() {},
    print() { throw new Error('Impresión bloqueada') },
  }
  printBillingTicket(popup, ticket)
  assert.match(status.textContent, /No se pudo abrir el selector/)
})
