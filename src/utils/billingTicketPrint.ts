export interface BillingTicketLine {
  cantidad: number
  descripcion: string
  precio: number
  observacion?: string
}

export interface BillingTicketPayment {
  metodo: string
  monto: number
}

export interface BillingTicketData {
  title?: string
  pedidoId?: number | string
  codigoFactura?: string
  fechaHora?: Date | string
  cedula?: string
  direccion?: string
  telefono?: string
  restaurantName?: string
  restaurantSub?: string
  items: BillingTicketLine[]
  subtotal: number
  servicioMonto?: number
  descuentoMonto?: number
  total: number
  pagos?: BillingTicketPayment[]
  totalPagado?: number
  vuelto?: number
  hasUsdPayments?: boolean
  totalPagadoUSD?: number
  vueltoUSD?: number
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatTicketAmount(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0'
  }
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)
}

export function formatTicketFechaHora(dateInput?: Date | string): string {
  const date = dateInput ? new Date(dateInput) : new Date()
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date

  const day = String(validDate.getDate()).padStart(2, '0')
  const month = String(validDate.getMonth() + 1).padStart(2, '0')
  const year = validDate.getFullYear()

  const hours = String(validDate.getHours()).padStart(2, '0')
  const minutes = String(validDate.getMinutes()).padStart(2, '0')
  const seconds = String(validDate.getSeconds()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

export function generateBillingTicketHtml(data: BillingTicketData): string {
  const formattedFechaHora = formatTicketFechaHora(data.fechaHora)

  const rowsHtml =
    data.items.length > 0
      ? data.items
          .map((item) => {
            const qty = Number(item.cantidad) > 0 ? Number(item.cantidad) : 1
            const priceStr = formatTicketAmount(item.precio)
            const note = item.observacion?.trim()
              ? `<div class="product-note">Obs: ${escapeHtml(item.observacion.trim())}</div>`
              : ''

            return `<div class="product-row"><span class="col-qty">${qty}</span><span class="col-desc">${escapeHtml(item.descripcion)}</span><span class="col-price">${priceStr}</span>${note}</div>`
          })
          .join('')
      : '<div class="empty-row">Sin productos</div>'

  const pagos = data.pagos ?? []
  const hasPayments = pagos.length > 0

  const paymentsHtml = hasPayments
    ? pagos
        .map(
          (pago) =>
            `<div class="payment-row"><span>${escapeHtml(pago.metodo)}</span><span>${formatTicketAmount(pago.monto)}</span></div>`,
        )
        .join('')
    : ''

  const paymentTotalsHtml = data.hasUsdPayments
    ? [
        (data.totalPagado ?? 0) > 0
          ? `<div class="total-row"><span>Total pagado CRC</span><span>${formatTicketAmount(data.totalPagado ?? 0)}</span></div>`
          : '',
        `<div class="total-row"><span>Total pagado USD</span><span>$${(data.totalPagadoUSD ?? 0).toFixed(2)}</span></div>`,
        (data.vuelto ?? 0) > 0
          ? `<div class="total-row"><span>Vuelto CRC</span><span>${formatTicketAmount(data.vuelto ?? 0)}</span></div>`
          : '',
        (data.vueltoUSD ?? 0) > 0
          ? `<div class="total-row"><span>Vuelto USD</span><span>$${(data.vueltoUSD ?? 0).toFixed(2)}</span></div>`
          : '',
      ]
        .filter(Boolean)
        .join('')
    : [
        (data.totalPagado ?? 0) > 0
          ? `<div class="total-row"><span>Total pagado</span><span>${formatTicketAmount(data.totalPagado ?? 0)}</span></div>`
          : '',
        (data.vuelto ?? 0) > 0
          ? `<div class="total-row"><span>Vuelto</span><span>${formatTicketAmount(data.vuelto ?? 0)}</span></div>`
          : '',
      ]
        .filter(Boolean)
        .join('')

  const invoiceNumber = data.codigoFactura?.trim()
    ? data.codigoFactura.trim()
    : data.pedidoId
      ? String(data.pedidoId)
      : '-'

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(data.title || 'Ticket de Facturación')}</title>
    <style>
      @page {
        margin: 1.5mm;
        size: 58mm auto;
      }
      html, body {
        margin: 0 auto;
        padding: 0;
        width: 52mm;
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 9px;
        line-height: 1.25;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        padding: 1mm 0;
      }
      .ticket {
        width: 100%;
        margin: 0 auto;
      }
      .header {
        text-align: center;
        margin-bottom: 6px;
      }
      .restaurant-name {
        font-size: 13px;
        font-weight: bold;
        color: #000;
        margin-bottom: 1px;
      }
      .restaurant-sub {
        font-size: 10px;
        font-weight: normal;
        margin-bottom: 4px;
      }
      .meta-info {
        font-size: 8.5px;
        margin-bottom: 1px;
        color: #000;
      }
      .scope-title {
        font-size: 9px;
        font-weight: bold;
        margin-top: 3px;
        text-transform: uppercase;
      }
      .table-header {
        display: grid;
        grid-template-columns: 24px 1fr auto;
        column-gap: 4px;
        font-size: 9.5px;
        font-weight: bold;
        margin-top: 6px;
        margin-bottom: 4px;
        padding-bottom: 2px;
      }
      .table-header span:last-child {
        text-align: right;
      }
      .product-row {
        display: grid;
        grid-template-columns: 24px 1fr auto;
        column-gap: 4px;
        padding: 2px 0;
        font-size: 9.5px;
        align-items: start;
      }
      .col-qty {
        font-weight: normal;
        text-align: left;
      }
      .col-desc {
        word-break: break-word;
      }
      .col-price {
        text-align: right;
        white-space: nowrap;
      }
      .product-note {
        grid-column: 2 / span 2;
        font-size: 8px;
        color: #4b5563;
        margin-top: 1px;
      }
      .empty-row {
        text-align: center;
        color: #6b7280;
        font-size: 8.5px;
        padding: 4px 0;
      }
      .divider {
        border-top: 1px dashed #000;
        margin: 5px 0;
      }
      .totals {
        margin-top: 2px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        margin: 2px 0;
        font-size: 9.5px;
      }
      .total-row.grand-total {
        font-weight: bold;
        font-size: 10.5px;
        margin-top: 4px;
      }
      .section-title {
        font-size: 9px;
        font-weight: bold;
        margin: 6px 0 2px;
        text-transform: uppercase;
      }
      .payment-row {
        display: flex;
        justify-content: space-between;
        font-size: 8.5px;
        padding: 1px 0;
      }
      .footer {
        text-align: center;
        margin-top: 10px;
        font-size: 9px;
        line-height: 1.35;
      }
    </style>
  </head>
  <body>
    <div class="ticket">
      <div class="header">
        <div class="restaurant-name">${escapeHtml(data.restaurantName || 'Brisas del Lago')}</div>
        <div class="restaurant-sub">${escapeHtml(data.restaurantSub || 'Restaurante')}</div>
        <div class="meta-info">Ced:${escapeHtml(data.cedula || '1-5580010047')}</div>
        <div class="meta-info">${escapeHtml(data.direccion || 'San Luis, Tilarán, Guanacaste')}</div>
        <div class="meta-info">Tel: ${escapeHtml(data.telefono || '26953363')}</div>
        <div class="meta-info">Fecha: ${formattedFechaHora}</div>
        <div class="meta-info">N° Factura: ${escapeHtml(invoiceNumber)}</div>
        ${data.title && data.title !== 'Cuenta completa' ? `<div class="scope-title">${escapeHtml(data.title)}</div>` : ''}
      </div>

      <div class="table-header">
        <span>Cant</span>
        <span>Descripción</span>
        <span>Precio</span>
      </div>

      <div class="products-list">
        ${rowsHtml}
      </div>

      <div class="divider"></div>

      <div class="totals">
        <div class="total-row">
          <span>SubTotal</span>
          <span>${formatTicketAmount(data.subtotal)}</span>
        </div>
        ${(data.servicioMonto ?? 0) > 0 ? `
          <div class="total-row">
            <span>10% Servicio</span>
            <span>${formatTicketAmount(data.servicioMonto ?? 0)}</span>
          </div>
        ` : ''}
        <div class="total-row">
          <span>Descuento</span>
          <span>:${formatTicketAmount(data.descuentoMonto ?? 0)}</span>
        </div>
        <div class="total-row grand-total">
          <span>Total a Pagar</span>
          <span>${formatTicketAmount(data.total)}</span>
        </div>
      </div>

      ${hasPayments ? `
        <div class="divider"></div>
        <div class="section-title">Pagos</div>
        <div class="payments">
          ${paymentsHtml}
        </div>
        <div class="totals" style="margin-top: 3px;">
          ${paymentTotalsHtml}
        </div>
      ` : ''}

      <div class="footer">
        <div>Gracias por su visita.</div>
        <div>Le esperamos pronto</div>
      </div>
    </div>
  </body>
</html>`
}

export function printBillingTicket(popup: Window, data: BillingTicketData): void {
  const html = generateBillingTicketHtml(data)
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}
