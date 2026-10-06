'use strict';
// Original ticket lettering and rhythm patterns from the approved STEPWIRE preview.
// Keep identity independent of official BPL artwork and of the user's installed fonts.
const seasonDesigns = {
  0: { label: 'ZERO', file: 'zero', year: '2023', color: '#9DDCFF', caption: 'エキシビション' },
  2: { label: 'S2', file: 's2', year: '2023', color: '#48DEEB', caption: '19試合' },
  4: { label: 'S4', file: 's4', year: '2024–2025', color: '#B69BFF', caption: '24試合' },
  5: { label: 'S5', file: 's5', year: '2025–2026', color: '#FFAD62', caption: '17試合' },
  6: { label: 'S6', file: 's6', year: '2026 開幕', color: '#C9EF63', caption: '観戦ガイド' },
};
function seasonLogo(n, cls = '', variant = 'badge') {
  const design = Object.hasOwn(seasonDesigns, n) ? seasonDesigns[n] : null;
  if (!design) return `<span class="season-logo season-fallback ${esc(cls)}">${esc(seasonLabel(n))}</span>`;
  const art = variant === 'art';
  return `<img class="season-logo season-${art ? 'ticket' : 'badge'} ${esc(cls)}" src="/bpl/seasons/${design.file}-${art ? 'art' : 'badge'}.svg" width="${art ? 220 : 65}" height="${art ? 116 : 28}" alt="${design.label}${Number(n) === 0 ? ' エキシビション' : ''}" decoding="async">`;
}
function seasonRail(selected = 'all') {
  const check = '<span class="season-check" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="m5 10 3 3 7-7" stroke="currentColor" stroke-width="2"/></svg></span>';
  return `<div class="season-rail-heading"><button type="button" class="season-all ${selected === 'all' ? 'active' : ''}" data-season="all" aria-pressed="${selected === 'all'}">全シーズン <span>64試合</span></button><span class="season-scroll-hint">横にスクロール →</span></div><div class="season-rail" aria-label="シーズンを選択">${Object.entries(seasonDesigns).map(([n, design]) => {
    const active = String(selected) === n;
    const tag = n === '6' ? 'a' : 'button';
    const action = n === '6' ? `href="#s6"${active ? ' aria-current="page"' : ''}` : `type="button" data-season="${n}" aria-pressed="${active}"`;
    return `<${tag} class="season-button ${active ? 'active' : ''}" style="--season-color:${design.color}" ${action}><small>${design.year}</small>${active ? check : ''}<span class="season-art">${seasonLogo(n, '', 'art')}</span><span class="season-tab-caption"><b>${design.label}</b><span>${design.caption}</span></span></${tag}>`;
  }).join('')}</div>`;
}
function bindSeasonRail() {
  const rail = document.querySelector('.season-rail');
  const active = rail?.querySelector('.season-button.active');
  if (rail && active && rail.scrollWidth > rail.clientWidth) {
    rail.scrollLeft = active.offsetLeft - rail.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  }
  document.querySelectorAll('[data-season]').forEach(button => {
    button.onclick = () => {
      const scrollLeft = rail?.scrollLeft ?? 0;
      navigate({view:'seasons',id:null,filters:{...state,season:button.dataset.season}},{scroll:false});
      const nextRail = document.querySelector('.season-rail');
      if (nextRail) nextRail.scrollLeft = scrollLeft;
      document.querySelector(`[data-season="${state.season}"]`)?.focus({ preventScroll: true });
    };
  });
}
