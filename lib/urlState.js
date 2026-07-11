/**
 * Shareable-URL helpers: the current allocation and simulator settings are
 * mirrored into the query string so any portfolio can be shared or
 * bookmarked — no backend involved.
 */

/** Serialize weights {ticker: pct} -> "URTH:40,AGG:20" */
export function encodeWeights(weights) {
  return Object.entries(weights)
    .filter(([, w]) => w > 0)
    .map(([t, w]) => `${t}:${w}`)
    .join(",");
}

/** Parse "URTH:40,AGG:20" -> {URTH: 40, AGG: 20}; null if invalid/empty. */
export function decodeWeights(str, validTickers) {
  if (!str) return null;
  const out = {};
  for (const part of str.split(",")) {
    const idx = part.lastIndexOf(":");
    if (idx < 1) return null;
    const ticker = part.slice(0, idx);
    const w = Number(part.slice(idx + 1));
    if (!validTickers.includes(ticker) || !Number.isFinite(w) || w <= 0 || w > 100) {
      return null;
    }
    out[ticker] = Math.round(w);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Merge params into the query string without adding history entries. */
export function updateUrlParams(params) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  window.history.replaceState(null, "", url.toString());
}

/** Read a numeric query param, or fallback. */
export function readNumParam(key, fallback, min, max) {
  if (typeof window === "undefined") return fallback;
  const raw = new URLSearchParams(window.location.search).get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
