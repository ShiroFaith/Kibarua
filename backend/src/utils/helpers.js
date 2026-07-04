/** Safely parse a JSON string column into an array/object; fall back on error. */
export function parseJson(value, fallback = []) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Coerce various inputs (array, JSON string, comma list) into a string array. */
export function toStringArray(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? arr.map(String) : [];
      } catch {
        /* fall through to comma split */
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v);
}

/** Coerce truthy-ish values ("1", "true", true, 1) to a 0/1 integer. */
export function toBit(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' || v === 'yes') return 1;
  return 0;
}

/** SQLite CURRENT timestamp helper for JS-side inserts. */
export function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
