// Bounded concurrency, used by both the CLI and the calibration run. An
// endpoint may queue a turn behind other work, so calls go out a few at a time
// rather than all at once.

/**
 * Run `fn` over `items`, at most `limit` at once, preserving order.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

