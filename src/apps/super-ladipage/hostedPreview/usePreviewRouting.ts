// ─────────────────────────────────────────────────────────────────────
// Hosted Preview — usePreviewRouting (INT)
//
// Hash-based routing: detects #preview=<sessionId> in URL and provides
// the sessionId. Listens for hashchange so deep-link navigation works.
//
// Used by main.tsx-level switching: when sessionId present, app renders
// HostedPreviewPage instead of the authenticated shell.
// ─────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

const HASH_PREFIX = '#preview='

/** Synchronous extraction — also exported for use outside React. */
export function extractPreviewSessionId(hash: string = window.location.hash): string | null {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return null
  const id = hash.slice(HASH_PREFIX.length).trim()
  if (!id) return null
  // Strip trailing slashes / query / additional hashes for safety
  return id.split(/[/&#?]/)[0]
}

/** Build the share URL for a session. */
export function buildPreviewUrl(sessionId: string, origin: string = window.location.origin): string {
  return `${origin}/${HASH_PREFIX}${encodeURIComponent(sessionId)}`
}

/** React hook — returns current preview session id (null if not in preview mode). */
export function usePreviewRouting(): string | null {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    extractPreviewSessionId(),
  )

  useEffect(() => {
    const onHashChange = () => {
      setSessionId(extractPreviewSessionId())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return sessionId
}
