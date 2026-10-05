// The full-record face of an audit: answers, probabilities, masses and all.

/**
 * @param {any[]} results
 * @param {{ ref?: string, model?: string, usage?: object }} [meta]
 */
export function formatJson(results, meta = {}) {
  return JSON.stringify({ ref: meta.ref, model: meta.model, usage: meta.usage, results }, null, 2);
}
