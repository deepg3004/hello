/**
 * Centralised HTTP client for LinkPlease.
 *
 * Base URL resolves in this order:
 *   1. import.meta.env.VITE_API_URL (Vite env var)
 *   2. window.location.origin (production)
 *
 * Cookies are always sent (credentials: 'include').
 *
 * @example
 *   import { api } from '@/lib/api'
 *   const products = await api.get('/api/products')
 *   await api.post('/api/automations', { name: 'My rule' })
 *
 * @example  Catch errors with the typed class:
 *   try { await api.post('/api/x', {}) }
 *   catch (err) {
 *     if (err instanceof FetchError) console.log(err.status, err.data)
 *   }
 */

const VITE_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || ''
const DEV_FALLBACK = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://127.0.0.1:8080'
  : ''

const RUNTIME_BASE = typeof window !== 'undefined' ? window.location.origin : ''

/**
 * Active base URL the client will prefix paths with.
 * @type {string}
 */
export const baseUrl = VITE_BASE || DEV_FALLBACK || RUNTIME_BASE || ''

/**
 * Typed error thrown when an HTTP response is not OK.
 *
 * @property {string} message  Human-readable error text
 * @property {number} status   HTTP status code
 * @property {*}      data     Parsed JSON body (when available) or raw text
 */
export class FetchError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {*}      data
   */
  constructor(message, status, data) {
    super(message)
    this.name = 'FetchError'
    this.status = status
    this.data = data
  }
}

/**
 * Mutable client object — request/response interceptors live here.
 * Set `api.onRequest = (config) => mutatedConfig` to inject auth headers etc.
 * Set `api.onError   = (FetchError) => void` to centralise error reporting.
 */
export const api = {
  /** @type {(config: { method: string, url: string, options: RequestInit }) => Promise<void> | void | typeof config} */
  onRequest: null,
  /** @type {(err: FetchError) => void} */
  onError: null,
  baseUrl,
  /**
   * Issue an HTTP request, parse JSON body, throw FetchError on !ok.
   * @template T
   * @param {string} method
   * @param {string} path
   * @param {*} [body]
   * @param {RequestInit} [extra]
   * @returns {Promise<T>}
   */
  async request(method, path, body, extra = {}) {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    const init = {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...(extra.headers || {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : null),
      ...extra,
    }

    let config = { method, url, options: init }
    if (typeof api.onRequest === 'function') {
      const next = await api.onRequest(config)
      if (next && next.options) config = next
    }

    let response
    try {
      response = await fetch(config.url, config.options)
    } catch (networkError) {
      const err = new FetchError(networkError.message || 'Network error', 0, null)
      if (typeof api.onError === 'function') api.onError(err)
      throw err
    }

    const contentType = response.headers.get('content-type') || ''
    let payload = null
    if (contentType.includes('application/json')) {
      payload = await response.json().catch(() => null)
    } else {
      payload = await response.text().catch(() => null)
    }

    if (!response.ok) {
      const message = (payload && typeof payload === 'object' && payload.message)
        || `${response.status} ${response.statusText}`
      const err = new FetchError(message, response.status, payload)
      if (typeof api.onError === 'function') api.onError(err)
      throw err
    }

    return /** @type {T} */ (payload)
  },
}

/**
 * GET request.
 * @template T
 * @param {string} path
 * @param {RequestInit} [extra]
 * @returns {Promise<T>}
 */
export const get = (path, extra) => api.request('GET', path, undefined, extra)

/**
 * POST request with JSON body.
 * @template T
 * @param {string} path
 * @param {*} [body]
 * @param {RequestInit} [extra]
 * @returns {Promise<T>}
 */
export const post = (path, body, extra) => api.request('POST', path, body, extra)

/**
 * PUT request with JSON body.
 * @template T
 * @param {string} path
 * @param {*} [body]
 * @param {RequestInit} [extra]
 * @returns {Promise<T>}
 */
export const put = (path, body, extra) => api.request('PUT', path, body, extra)

/**
 * PATCH request with JSON body.
 * @template T
 * @param {string} path
 * @param {*} [body]
 * @param {RequestInit} [extra]
 * @returns {Promise<T>}
 */
export const patch = (path, body, extra) => api.request('PATCH', path, body, extra)

/**
 * DELETE request.
 * @template T
 * @param {string} path
 * @param {RequestInit} [extra]
 * @returns {Promise<T>}
 */
export const del = (path, extra) => api.request('DELETE', path, undefined, extra)

export default api
