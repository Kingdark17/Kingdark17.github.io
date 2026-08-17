/** `clamp`/`integer`/`clone` do server.js original — sanear payload de socket não-confiável. */

export function clampNumber(value: unknown, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

export function clampInt(value: unknown, min: number, max: number): number {
  return Math.floor(clampNumber(value, min, max));
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
