export interface KitchenTicketLine {
  producto: string
  cantidad: number
  observacion?: string
}

export interface KitchenTicketData {
  pedidoId: number
  codigo?: string
  locationLabel?: string
  printedAt?: Date
  productos: KitchenTicketLine[]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatPrintedAt(value: Date): string {
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

export function prepareKitchenPrintWindow(printWindow: Window) {
  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Preparando comanda...</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Arial, sans-serif;
        background: #fff;
        color: #111;
      }
    </style>
  </head>
  <body>
    <p>Preparando comanda...</p>
  </body>
</html>`)
  printWindow.document.close()
}

export function printKitchenTicket(printWindow: Window, ticket: KitchenTicketData) {
  const printedAt = ticket.printedAt ?? new Date()
  const productsHtml =
    ticket.productos.length > 0
      ? ticket.productos
          .map((item) => {
            const note = item.observacion?.trim()
              ? `<div class="note">Obs: ${escapeHtml(item.observacion.trim())}</div>`
              : ''

            return `<div class="line"><div class="line-main"><span class="qty">${Number(item.cantidad) > 0 ? Number(item.cantidad) : 1}x</span><span class="name">${escapeHtml(item.producto)}</span></div>${note}</div>`
          })
          .join('')
      : '<div class="empty">No hay productos para imprimir.</div>'

  const locationHtml = ticket.locationLabel
    ? `<div class="meta-row"><span class="meta-label">Origen</span><span class="meta-value">${escapeHtml(ticket.locationLabel)}</span></div>`
    : ''

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Comanda cocina ${ticket.codigo ? `- ${escapeHtml(ticket.codigo)}` : ''}</title>
    <style>
      :root {
        color-scheme: light;
      }
      @page { margin: 3mm; size: 80mm auto; }
      html, body {
        margin: 0 auto;
        padding: 0;
        width: 72mm;
        font-family: 'Courier New', monospace;
        background: #fff;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body { padding: 2mm 0; }
      .ticket {
        width: 100%;
        margin: 0 auto;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 16px;
        text-align: center;
        text-transform: uppercase;
      }
      .meta {
        border-top: 1px dashed #000;
        border-bottom: 1px dashed #000;
        padding: 6px 0;
        margin-bottom: 8px;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 3px;
        font-size: 10px;
      }
      .meta-row:last-child {
        margin-bottom: 0;
      }
      .meta-label {
        font-weight: 700;
      }
      .meta-value {
        text-align: right;
      }
      .line {
        padding: 5px 0;
        border-bottom: 1px dashed #000;
      }
      .line-main {
        display: flex;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
      }
      .qty {
        min-width: 28px;
      }
      .name {
        flex: 1;
        word-break: break-word;
      }
      .note {
        margin-top: 2px;
        padding-left: 34px;
        font-size: 10px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .empty {
        font-size: 10px;
        padding: 8px 0;
      }
    </style>
  </head>
  <body>
    <main class="ticket">
      <h1>Comanda cocina</h1>
      <section class="meta">
        <div class="meta-row"><span class="meta-label">Pedido</span><span class="meta-value">#${ticket.pedidoId}</span></div>
        ${ticket.codigo ? `<div class="meta-row"><span class="meta-label">Codigo</span><span class="meta-value">${escapeHtml(ticket.codigo)}</span></div>` : ''}
        ${locationHtml}
        <div class="meta-row"><span class="meta-label">Impresion</span><span class="meta-value">${escapeHtml(formatPrintedAt(printedAt))}</span></div>
      </section>
      <section>
        ${productsHtml}
      </section>
    </main>
  </body>
</html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}