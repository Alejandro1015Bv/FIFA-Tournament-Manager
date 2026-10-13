// Aleatoriedad: Fisher-Yates + crypto.getRandomValues (fallback: Math.random, documentado en README).
export function randomInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError('maxExclusive inválido');
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    // Muestreo por rechazo para evitar sesgo de módulo.
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    do { c.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickOne(list) {
  if (!list.length) throw new Error('Lista vacía');
  return list[randomInt(list.length)];
}

export function newId(prefix = 'id') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
}
