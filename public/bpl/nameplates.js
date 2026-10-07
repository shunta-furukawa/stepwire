// Original STEPWIRE typography. Team names identify archive records; no logos or
// team-specific lettering are reproduced. Preserve spelling and season aliases.
const layouts = Object.freeze({
  'APINA VRAMeS': {kind:'split',top:'APINA',main:'VRAMeS'},
  'GiGO': {kind:'short',top:'',main:'GiGO'},
  'GAME PANIC': {kind:'equal',top:'GAME',main:'PANIC'},
  'SILK HAT': {kind:'equal',top:'SILK',main:'HAT'},
  'SUPERNOVA Tohoku': {kind:'long-split',top:'SUPERNOVA',main:'Tohoku'},
  'TAITO STATION Tradz': {kind:'split',top:'TAITO STATION',main:'Tradz'},
  'ROUND1': {kind:'mid',top:'',main:'ROUND1'},
  'LEISURELAND': {kind:'long',top:'',main:'LEISURELAND'},
  'レジャーランド': {kind:'jp',top:'',main:'レジャーランド'},
  'Team BLUE': {kind:'split',top:'Team',main:'BLUE'},
  'Team WHITE': {kind:'split',top:'Team',main:'WHITE'},
  'Team RED': {kind:'split',top:'Team',main:'RED'},
});
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nameplateParts(name) {
  return {...(Object.hasOwn(layouts,name)?layouts[name]:{kind:'fallback',top:'',main:String(name??'')})};
}
export function nameplateMarkup(name,cls='',style='') {
  const {kind,top,main}=nameplateParts(name);
  return `<span class="team-nameplate np-${kind}${cls?' '+escapeHTML(cls):''}" style="${escapeHTML(style)}" role="img" aria-label="${escapeHTML(name)}"><span class="nameplate-copy" aria-hidden="true">${top?`<span class="nameplate-top">${escapeHTML(top)}</span>`:''}<span class="nameplate-main">${escapeHTML(main)}</span></span></span>`;
}
