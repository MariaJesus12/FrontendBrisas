const DEFAULT_DEV_API_URL = 'http://localhost:3000/api'
const DEFAULT_PROD_API_URL = 'https://api.restaurantebrisasdellago.com/api'
const DEFAULT_API_TIMEOUT_MS = 10000

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function parseTimeout(value: string | undefined): number {
  if (!value) return DEFAULT_API_TIMEOUT_MS
  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_API_TIMEOUT_MS
  return parsed
}

const fallbackApiUrl = import.meta.env.PROD ? DEFAULT_PROD_API_URL : DEFAULT_DEV_API_URL
const rawApiUrl = import.meta.env.VITE_API_URL ?? fallbackApiUrl

export const env = {
  apiUrl: normalizeApiUrl(rawApiUrl),
  apiTimeoutMs: parseTimeout(import.meta.env.VITE_API_TIMEOUT_MS),
} as const
