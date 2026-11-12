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
  esComandaAdicional?: boolean
  productos: KitchenTicketLine[]
}

interface KitchenPrintConfirmResult {
  ok: boolean
  message?: string
  browserPrint?: boolean
}

type KitchenPrintWindow = Window & {
  __confirmKitchenPrint__?: () => Promise<KitchenPrintConfirmResult>
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function openKitchenPrintPreview(
  printWindow: Window,
  ticket: KitchenTicketData,
  onConfirmKitchenPrint: () => Promise<KitchenPrintConfirmResult>,
) {
  const previewWindow = printWindow as KitchenPrintWindow
  previewWindow.__confirmKitchenPrint__ = onConfirmKitchenPrint

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

  const locationLabel = ticket.locationLabel?.trim()
    ? escapeHtml(ticket.locationLabel.trim().toUpperCase())
    : 'COCINA'
  const headingLabel = ticket.esComandaAdicional ? `COMANDA ADICIONAL · ${locationLabel}` : locationLabel

  previewWindow.document.open()
  previewWindow.document.write(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Comanda cocina ${ticket.codigo ? `- ${escapeHtml(ticket.codigo)}` : ''}</title>
    <style>
      :root {
        color-scheme: light;
      }
      @page { margin: 2mm; size: 58mm auto; }
      html, body {
        margin: 0 auto;
        padding: 0;
        width: 54mm;
        /* Tahoma mantiene trazos claros y compactos en impresoras térmicas. */
        font-family: Tahoma, Arial, Helvetica, sans-serif;
        font-size: 14px;
        font-weight: 700;
        background: #fff;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body { padding: 1.5mm 0; }
      .ticket {
        width: 100%;
        margin: 0 auto;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 19px;
        font-weight: 700;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .line {
        padding: 7px 0;
        border-bottom: 1px dashed #000;
      }
      .line-main {
        display: flex;
        gap: 6px;
        font-size: 14px;
        font-weight: 700;
      }
      .qty {
        min-width: 34px;
      }
      .name {
        flex: 1;
        word-break: break-word;
      }
      .note {
        margin-top: 3px;
        padding-left: 38px;
        font-size: 12px;
        font-weight: 700;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .empty {
        font-size: 11px;
        font-weight: 400;
        padding: 8px 0;
      }
      .actions {
        margin: 10px 0 8px;
      }
      .button {
        width: 100%;
        border: 0;
        border-radius: 6px;
        padding: 10px 12px;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        background: #111827;
        color: #fff;
        cursor: pointer;
      }
      .button:disabled {
        opacity: 0.65;
        cursor: wait;
      }
      .status {
        margin-top: 6px;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        min-height: 14px;
      }
      @media print {
        .actions {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="ticket">
      <h1>${headingLabel}</h1>
      <section>
        ${productsHtml}
      </section>
      <section class="actions">
        <button id="kitchen-print-button" class="button" type="button">Imprimir y enviar a cocina</button>
        <div id="kitchen-print-status" class="status">Revisa la comanda y elige una impresora al confirmar.</div>
      </section>
    </main>
    <script>
      const button = document.getElementById('kitchen-print-button')
      const status = document.getElementById('kitchen-print-status')
      let confirmed = false

      function openPrintDialog() {
        try {
          window.focus()
          window.print()
        } catch {
          status.textContent = 'No se pudo abrir el selector. Revisa la configuración del navegador y vuelve a intentarlo.'
        }
      }

      async function handleConfirmPrint() {
        if (!button || !status || typeof window.__confirmKitchenPrint__ !== 'function') {
          return
        }

        if (confirmed) {
          openPrintDialog()
          return
        }

        button.disabled = true
        status.textContent = 'Enviando comanda a cocina...'

        let result
        try {
          result = await window.__confirmKitchenPrint__()
        } catch {
          status.textContent = 'No fue posible enviar la comanda.'
          button.disabled = false
          return
        }

        if (!result || !result.ok) {
          status.textContent = result && result.message ? result.message : 'No fue posible enviar la comanda.'
          button.disabled = false
          return
        }

        if (!result.browserPrint) {
          status.textContent = result.message || 'La comanda se envió a la cola de impresión.'
          return
        }

        confirmed = true
        button.textContent = 'Volver a abrir selector de impresora'
        button.disabled = false
        status.textContent = 'Comanda registrada. Si cancelaste o no se imprimió, vuelve a abrir el selector.'
        openPrintDialog()
      }

      button && button.addEventListener('click', () => {
        void handleConfirmPrint()
      })
    </script>
  </body>
</html>`)
  previewWindow.document.close()
  previewWindow.focus()
}
