# Frontend Brisas

Frontend React + TypeScript para gestion interna y portada publica del restaurante.

## Requisitos

- Node.js 20+
- npm 10+

## Instalacion

```bash
npm install
```

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Ajusta los valores segun tu backend.

```env
VITE_API_URL=http://localhost:3000/api
VITE_API_TIMEOUT_MS=10000
```

### Entornos recomendados

- `.env.development`: conexion local (ya incluido).
- `.env.production`: URL de produccion (ya incluido como plantilla).

Vite carga automaticamente el archivo segun el modo.

## Ejecutar en desarrollo

```bash
npm run dev
```

Si ejecutas `npm run dev -c` puede fallar por argumento no valido. Usa solo `npm run dev`.

## Build de produccion

```bash
npm run build
```

## Pedidos para llevar y cocina

- La pantalla de pedidos para llevar muestra primero los borradores, del mas reciente al mas antiguo. Esta lista se mantiene independiente de los filtros de la lista general y ofrece las mismas acciones.
- Al agregar una linea a un pedido existente, busca el producto por codigo o nombre. El precio mostrado proviene del catalogo; el backend calcula el precio definitivo y actualiza el total al guardar.
- La comanda incluye solamente las unidades pendientes de enviar. Si el pedido cambia mientras esta abierta la vista previa, cierrala y vuelve a abrirla para revisar la nueva comanda.
- Al confirmar la comanda se abre el selector de impresoras del navegador. Si se cancela la impresion, se puede abrir de nuevo desde la misma ventana sin reenviar el pedido. El navegador no confirma si la impresora completo la impresion.
- El backend debe tener aplicada la migracion de comandas incrementales `20260809_comandas_incrementales.sql`, exponer `cantidadEnviadaCocina` y admitir `metodoImpresion: "NAVEGADOR"` en `POST /pedidos/:id/enviar-cocina` y `POST /pedidos/:id/facturar`. Este modo no crea trabajos en la cola. Actualiza el backend antes del frontend: si aun usa la version anterior, el envio a cocina se encola y no se abre el selector para evitar duplicados; la facturacion podria crear un trabajo adicional.
- Los recibos y reimpresiones abren el selector del navegador y permiten volver a abrirlo desde la vista del recibo. Habilita las ventanas emergentes para el sitio y verifica que la impresora este instalada en el equipo.

## Configuracion Backend (paso a paso)

### 1) URL base

- Configura `VITE_API_URL` con la URL real de tu API.
- Si tu backend usa prefijo global `/api`, mantenlo en la variable.

Ejemplos:

- `https://api.restaurantebrisasdellago.com/api`
- `http://localhost:3000/api`

### 2) CORS en backend

Habilita CORS para el frontend:

- Desarrollo: `http://localhost:5173`
- Produccion: `https://restaurantebrisasdellago.com`

### 3) Contrato de autenticacion esperado

Endpoint usado por el frontend:

- `POST /auth/login`

Body:

```json
{
  "email": "admin@brisas.com",
  "password": "123456"
}
```

Respuesta esperada:

```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "nombre": "Admin",
    "email": "admin@brisas.com",
    "rol": "admin"
  }
}
```

### 4) Endpoints ya cableados en el frontend

- Auth
  - `POST /auth/login`
- Reservaciones
  - `GET /reservaciones`
  - `GET /reservaciones/:id`
  - `POST /reservaciones`
  - `PUT /reservaciones/:id`
  - `PATCH /reservaciones/:id/estado`
  - `DELETE /reservaciones/:id`
- Menu
  - `GET /categories`
  - `GET /categories/:id/products`
  - `POST /categories`
  - `PUT /categories/:id`
  - `DELETE /categories/:id`
  - `GET /products`
  - `GET /products/:id`
  - `POST /products`
  - `PUT /products/:id`
  - `DELETE /products/:id`
- Plato del mes
  - `GET /dish-of-month`
  - `GET /dish-of-month/history`
  - `POST /dish-of-month`
  - `PUT /dish-of-month/:id`
  - `DELETE /dish-of-month/:id`
- Anuncios
  - `GET /announcements`
  - `GET /announcements/history`
  - `POST /announcements`
  - `PUT /announcements/:id`
  - `DELETE /announcements/:id`
- Pedidos
  - `GET /pedidos`
  - `GET /pedidos/:id`
  - `POST /pedidos`
  - `PATCH /pedidos/:id/estado`
  - `DELETE /pedidos/:id`

### 5) Seguridad y sesion

- El token se envia automaticamente en `Authorization: Bearer <token>`.
- Si el backend responde `401`, el frontend limpia sesion y redirige a `/login`.

## Archivos clave de integracion

- `src/config/env.ts`: lectura y normalizacion de variables de entorno.
- `src/services/api.ts`: instancia Axios central (base URL, timeout, interceptores).
- `src/services/*.ts`: capa de servicios por modulo.
