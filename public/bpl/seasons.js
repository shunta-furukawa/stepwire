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
  document.querySelectorAll('button[data-season]').forEach(button => {
    button.onclick = () => {
      const scrollLeft = rail?.scrollLeft ?? 0;
      navigate({view:'seasons',id:null,filters:{...state,season:button.dataset.season}},{scroll:false});
      const nextRail = document.querySelector('.season-rail');
      if (nextRail) nextRail.scrollLeft = scrollLeft;
      document.querySelector(`button[data-season="${state.season}"]`)?.focus({ preventScroll: true });
    };
  });
}

function seasonTeamFilters() {
  const ids=Standings.seasonTeamIds(D,state.season);
  return `<div class="team-strip season-team-filters" aria-label="対戦カードのチームを選択"><button type="button" data-team-filter="all" aria-pressed="${state.team==='all'}"><span class="team-filter-all">全チーム</span><small>${state.team==='all'?'選択中':'すべて表示'}</small></button>${Object.keys(D.teams).map(id=>{
    const enabled=ids.includes(id),selected=state.team===id;
    return `<button type="button" data-team-filter="${esc(id)}" aria-pressed="${selected}" ${enabled?'':'disabled aria-disabled="true"'} style="${teamVars(id)}" title="${esc(teamName(id,state.season))}${enabled?'':'：このシーズンは不参加'}">${logo(id,state.season)}<small>${enabled?(selected?'選択中':'絞り込む'):'不参加'}</small></button>`;
  }).join('')}</div>`;
}

function seasonResults(season) {
  if(season==='all')return `<section class="season-results" data-season="all" aria-labelledby="season-results-title"><div class="section-head"><h2 id="season-results-title">シーズン別の結果</h2></div><p class="small-note">シーズンを選ぶと、全チームの順位と最終成績を表示します。</p><div class="season-winners">${[5,4,2,0].map(n=>{
    const final=D.matches.find(m=>m.season===n&&m.stage==='final'),id=final.teams[final.points[0]>final.points[1]?0:1];
    return `<button type="button" data-season="${n}" class="season-winner" style="${teamVars(id)}">${seasonLogo(n)}<small>${n===0?'エキシビション優勝':'優勝'}</small><strong>${esc(team(id).name)}</strong><span>全チームの結果を見る →</span></button>`;
  }).join('')}</div></section>`;
  const n=Number(season),record=Standings.seasonStandings[n];
  if(n===6)return `<section class="season-results season-pending" data-season="6" aria-labelledby="season-results-title"><div class="section-head"><h2 id="season-results-title">S6の順位・成績</h2><span class="badge">開幕前</span></div><p class="pending-title">順位未確定</p><p class="small-note">出場予定の${s6Teams().length}チーム。試合が始まる前のため、順位・勝点はありません。</p><div class="pending-teams">${s6Teams().map(id=>`<a href="#team/${id}" style="${teamVars(id)}">${logo(id,6)}<span>${esc(teamName(id,6))}</span></a>`).join('')}</div>${external(S6.rosterSource,'公式ドラフト結果','standings-source')}</section>`;
  if(!record)return '';
  const finishes=Standings.tournamentFinishes(D,n),final=D.matches.find(m=>m.season===n&&m.stage==='final'),winner=final.points[0]>final.points[1]?0:1;
  return `<section class="season-results" data-season="${n}" aria-labelledby="season-results-title"><div class="section-head"><h2 id="season-results-title">${seasonLabel(n)}の順位・成績</h2><span class="badge">${n===0?'エキシビション':'全日程終了'}</span></div>
  <div class="season-finalists">${[winner,1-winner].map((side,i)=>`<a class="season-finalist" href="#team/${final.teams[side]}" style="${teamVars(final.teams[side])}"><span class="finish-label">${i===0?'優勝':'準優勝'}</span>${logo(final.teams[side],n)}<strong>${esc(teamName(final.teams[side],n))}</strong></a>`).join('')}<button type="button" class="season-final-score" data-match="${final.id}"><small>FINAL</small><strong>${final.points[winner]} <span>–</span> ${final.points[1-winner]}</strong><span>決勝の詳細 →</span></button></div>
  <div class="standings-heading"><h3>${n===0?'予選リーグ順位':'レギュラーステージ順位'}</h3>${external(record.source,'公式順位表 ↗','standings-source')}</div><p class="small-note standings-note">${esc(record.note)} 順位は${n===2?'グループ内の':n===0?'予選の':'レギュラーの'}順位、最終成績は決勝トーナメントの到達結果です。</p>
  <div class="standings-groups">${record.groups.map(group=>`<div class="standings-group"><table class="standings-table"><caption>${esc(group.name)}</caption><thead><tr><th scope="col">順位</th><th scope="col">チーム</th><th scope="col">${esc(record.metric)}</th><th scope="col">勝–分–敗</th><th scope="col">最終成績</th></tr></thead><tbody>${group.rows.map((row,i)=>`<tr class="standings-row" data-team="${row.team}" style="${teamVars(row.team)}"><td class="standing-rank">${i+1}</td><th scope="row"><a href="#team/${row.team}">${esc(teamName(row.team,n))}</a></th><td class="standing-points">${row.value}</td><td class="standing-record" aria-label="${row.wins}勝 ${row.draws}分 ${row.losses}敗">${row.wins}–${row.draws}–${row.losses}</td><td><span class="standing-finish ${finishes[row.team]==='優勝'?'is-champion':''}">${n===0&&finishes[row.team]==='レギュラー敗退'?'予選敗退':esc(finishes[row.team])}</span></td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
  <p class="small-note standings-scope">シーズン全体の結果です。下の対戦カードの絞り込みでは変わりません。${n===0?'':'ベスト4・ベスト8内の順位は付けていません。'}</p></section>`;
}
