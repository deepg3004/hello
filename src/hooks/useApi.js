/**
 * useApi — reusable cached data-fetching hook for LinkPlease.
 *
 * Features:
 *   • Module-level Map cache keyed by request path
 *   • TTL-based freshness (default 30s) — stale data still returns immediately,
 *     a silent background refresh is kicked off to keep cache warm
 *   • AbortController wired to component unmount + manual refetch
 *   • `loading` only flips true on the very first uncached fetch — subsequent
 *     refreshes are silent (no jank in the UI)
 *   • Stable refetch() callback bypasses the cache
 *
 * @example
 *   const { data, loading, error, refetch } = useApi('/api/products', { ttl: 60000 })
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, FetchError } from '../lib/api.js'

const cache = new Map()

/**
 * Clear cached responses.
 *
 * @example
 *   clearCache()                 // wipe everything
 *   clearCache('/api/messages')  // wipe one key
 *
 * @param {string} [path] Path to clear. Omit to clear all.
 */
export function clearCache(path) {
  if (typeof path === 'string') {
    cache.delete(path)
  } else {
    cache.clear()
  }
}

/**
 * @typedef {Object} UseApiOptions
 * @property {boolean} [immediate=true]  Run on mount (and when deps change).
 * @property {number}  [ttl=30000]       Cache entry freshness in ms.
 * @property {Array<*>} [deps=[]]        Extra reactive deps that re-trigger fetch.
 */

/**
 * @typedef {Object} UseApiResult
 * @property {*}              data
 * @property {boolean}        loading
 * @property {FetchError|null} error
 * @property {() => Promise<*>} refetch
 */

/**
 * @template T
 * @param {string} path
 * @param {UseApiOptions} [options]
 * @returns {UseApiResult}
 */
export function useApi(path, options) {
  const { immediate = true, ttl = 30000, deps = [] } = options || {}

  const cached = cache.get(path)
  const initialFresh = cached && Date.now() - cached.timestamp < ttl
  const [data, setData] = useState(cached?.data ?? null)
  const [loading, setLoading] = useState(immediate && !cached)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)
  const controllerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (controllerRef.current) controllerRef.current.abort()
    }
  }, [])

  const runFetch = useCallback(async ({ silent }) => {
    if (controllerRef.current) controllerRef.current.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    if (!silent && mountedRef.current) {
      setLoading(true)
    }

    try {
      const response = await api.request('GET', path, undefined, { signal: controller.signal })
      if (!mountedRef.current) return response
      cache.set(path, { data: response, timestamp: Date.now() })
      setData(response)
      setError(null)
      setLoading(false)
      return response
    } catch (err) {
      if (err && err.name === 'AbortError') return null
      if (!mountedRef.current) return null
      if (err instanceof FetchError) {
        setError(err)
      } else {
        setError(new FetchError(err.message || 'Unknown error', 0, null))
      }
      setLoading(false)
      throw err
    }
  }, [path])

  // Stable refetch — always bypasses cache.
  const refetch = useCallback(() => runFetch({ silent: false }), [runFetch])

  useEffect(() => {
    if (!immediate) return undefined

    if (cached && initialFresh) {
      // Already fresh — silent background refresh to keep data warm
      runFetch({ silent: true }).catch(() => {})
    } else {
      runFetch({ silent: !!cached }).catch(() => {})
    }

    return () => {
      if (controllerRef.current) controllerRef.current.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, immediate, ...deps])

  return { data, loading, error, refetch }
}

export default useApi
