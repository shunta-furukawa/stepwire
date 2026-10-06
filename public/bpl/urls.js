/**
 * A shared URL must survive plain-text auto-linkers that strip final punctuation.
 * URLSearchParams/encodeURIComponent leave periods literal, including in O4MA.
 * Encode those periods explicitly and end every generated query with a safe marker.
 * Decoding still produces the exact original ID; no slug aliases or collisions exist.
 * @param {URLSearchParams} params
 */
export function shareQuery(params) {
  const query = new URLSearchParams(params);
  query.delete('linkVersion');
  query.set('linkVersion', '1');
  return query.toString().replace(/\./g, '%2E');
}
