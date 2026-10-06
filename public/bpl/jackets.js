/** Four-color-only prototype. Does not fetch or reconstruct official artwork. */
export const QUADRANTS = Object.freeze(['topLeft', 'topRight', 'bottomLeft', 'bottomRight']);
const HEX = /^#[a-f0-9]{6}$/i;
const VARS = ['tl', 'tr', 'bl', 'br'];
export function validPalette(record) {
  return !!record && typeof record === 'object' && QUADRANTS.every(key =>
    Object.hasOwn(record, key) && typeof record[key] === 'string' && record[key].length === 7 && HEX.test(record[key]));
}
export function paletteForTitle(data, title) {
  const songs = data?.songs;
  return songs && Object.hasOwn(songs, title) && validPalette(songs[title]) ? songs[title] : null;
}
export function gradientVariables(record) {
  if (!validPalette(record)) return '';
  return QUADRANTS.map((key, index) => `--jacket-${VARS[index]}:${record[key].toLowerCase()}`).join(';');
}
export function jacketMarkup(title, data, sizeClass = '') {
  const size = ['', 'mini-jacket', 'duel-jacket'].includes(sizeClass) ? sizeClass : '';
  const palette = paletteForTitle(data, title);
  return palette
    ? `<span class="music-jacket music-gradient ${size}" style="${gradientVariables(palette)}" aria-hidden="true"></span>`
    : `<span class="music-jacket music-symbol ${size}" aria-hidden="true">♪</span>`;
}
