export { shareQuery } from '../../public/bpl/urls.js';
import { createHash } from 'node:crypto';
import data from '../../public/bpl/data.json';
import portraits from '../../docs/bpl-generated-portraits.json';
import { playerSummary, teamSummary, teamRoster, portraitFor, teamName, seasonName } from './summary';
import { matrixModel, matrixOptions } from '../../public/bpl/matrix.js';
import brand from '../../public/bpl/brand.json';
import { normalizeSeasonFilters } from '../../public/bpl/standings.js';

const teams: Record<string, {name:string;short:string;color:string}> = data.teams;
const palette: Record<string, {color?:string}> = brand.teams;
// Changes to data, identity or card design invalidate social image caches.
export const summaryVersion = '1';
export const summaryRevision = createHash('sha256').update(JSON.stringify([summaryVersion, data, brand, portraits.portraits])).digest('hex').slice(0, 16);
const seasons = ['all','0','2','4','5','6'];
const stageNames: Record<string,string> = {regular:'レギュラー',quarter:'クォーターファイナル',semi:'セミファイナル',final:'ファイナル'};
const label = (s:string|number) => String(s)==='0'?'ZERO':String(s)==='all'?'全シーズン':`S${s}`;
export function shareModel(input: URLSearchParams) {
  const p = new URLSearchParams();
  const view = input.get('view') || 's6';
  if (!['s6','preview','matrix','seasons','teams','team','players','player','versus','match','about'].includes(view)) throw new RangeError('Unknown view');
  p.set('view',view);if(view==='matrix')p.set('matrixVersion','2');
  const person = (id:string) => data.players.find(x=>x.id===id);
  for(const key of [...Object.keys(matrixOptions),'hideResults','previewA','previewB','id','rosterSeason','season','team','stage','query','playerSeason','playerTeam','sort','a','b','vsSeason','vsFormat','partnerA','partnerB']) {
    const value=input.get(key); if(value===null)continue;
    let valid=false;
    if(Object.hasOwn(matrixOptions,key))valid=(matrixOptions[key as keyof typeof matrixOptions] as string[]).includes(value);
    else if(key==='hideResults')valid=['0','1'].includes(value);
    else if(['previewA','previewB'].includes(key))valid=data.players.some(x=>x.history.some(h=>h.season===6&&h.team===value));
    else if(key==='id')valid=view==='match'?data.matches.some(m=>m.id===value):view==='team'?Object.hasOwn(teams,value):view==='player'?!!person(value):false;
    else if(['season','playerSeason','vsSeason','rosterSeason'].includes(key))valid=seasons.includes(value);
    else if(['team','playerTeam'].includes(key))valid=value==='all'||Object.hasOwn(teams,value);
    else if(key==='stage')valid=value==='all'||Object.hasOwn(stageNames,value);
    else if(key==='query')valid=value.length<=100;
    else if(key==='sort')valid=['matches','wins','firsts','name'].includes(value);
    else if(key==='vsFormat')valid=['all','single','tag'].includes(value);
    else valid=(key.startsWith('partner')&&value==='all')||!!person(value);
    if(!valid)throw new RangeError(`Invalid ${key}`);p.set(key,value);
  }
  const hidden=p.get('hideResults')!=='0';p.set('hideResults',hidden?'1':'0');
  const matches=hidden?data.matches.filter(m=>m.season!==6):data.matches;
  const id=p.get('id')||'';
  if(['player','team','match'].includes(view)&&!id)throw new RangeError('Missing id');
  const get=(key:string,fallback='all')=>p.get(key)||fallback;
  let title='BPL DDR 戦績', detail='シーズン・チーム・選手・直接対決', metric=`${matches.length}試合`, eyebrow='ARCHIVE', color='#b4da46';
  let score='', left='',right='';
  let matrix: ReturnType<typeof matrixModel> | null = null;
  let entity: { kind: 'player'; stats: ReturnType<typeof playerSummary>; portrait: string | null; affiliation: string } | { kind: 'team'; stats: ReturnType<typeof teamSummary>; roster: ReturnType<typeof teamRoster> } | null = null;
  if(view==='s6'||view==='preview'||view==='matrix') {
    title='S6 観戦ガイド';detail='7チーム・28選手 / 新体制と過去の対戦';metric='推しチーム・対戦プレビュー・結果非表示';eyebrow='SEASON 6';
    if(view==='preview'||view==='matrix'){
      const a=p.get('previewA'),b=p.get('previewB');if(!a||!b||a===b)throw new RangeError('Choose two S6 teams');
      title=`${teams[a]!.short} vs ${teams[b]!.short}`;detail='S6 対戦プレビュー / 出場選手・対戦順は未発表';
      metric=`S5以前のチーム対戦 ${data.matches.filter(m=>m.season<6&&m.teams.includes(a)&&m.teams.includes(b)).length}試合`;eyebrow='PREVIEW';
      if(view==='matrix'){
        matrix=matrixModel(data,a,b,Object.fromEntries(p));
        title=`${teams[a]!.short} × ${teams[b]!.short}`;eyebrow='HEAD TO HEAD';
        detail=Object.entries(matrix.filters).map(([k,v])=>v==='all'?(k==='matrixSeason'?'S2–S5':k==='matrixFormat'?'Single + Duo':k==='matrixCategory'?'全区分':'全傾向'):k==='matrixSeason'?'S'+v:v==='tag'?'Duo':v==='single'?'Single':v).join(' / ');
        metric='S6登録選手の過去対戦 / 行の選手から見た個人EX SCORE比較';
      }
    }
  } else if(view==='seasons') {
    const normalized=normalizeSeasonFilters(data,{season:get('season'),team:get('team'),stage:get('stage')});
    const {season:s,team:t,stage}=normalized;
    for(const key of ['season','team','stage'] as const)if(p.has(key)||normalized[key]!==get(key))p.set(key,normalized[key]);
    const ms=matches.filter(m=>(s==='all'||String(m.season)===s)&&(t==='all'||m.teams.includes(t))&&(stage==='all'||m.stage===stage));
    title=`${label(s)} · BPL DDR`;detail=[t==='all'?'全チーム':teams[t]!.name,stage==='all'?'全ステージ':stageNames[stage]].join(' / ');metric=`${ms.length}試合`;eyebrow='SEASON';
  } else if(view==='match') {
    const m=data.matches.find(m=>m.id===id)!;
    const round=input.get('round');if(round&&m.battles.some(b=>String(b.number)===round))p.set('round',round);
    left=teams[m.teams[0]!]!.short;right=teams[m.teams[1]!]!.short;
    title=`${left} vs ${right}`;score=m.season===6&&hidden?'結果は非表示':m.points.join(' — ');metric=`${m.date} · ${m.label}`;detail=`${label(m.season)} / ${stageNames[m.stage]}`;eyebrow='MATCH RESULT';
  } else if(view==='team') {
    const roster=teamRoster(id,p.get('rosterSeason')), summary=teamSummary(id,matches);
    p.set('rosterSeason',String(roster.season));p.set('summaryVersion',summaryVersion);
    title=teamName(id,roster.latest);color=palette[id]?.color||teams[id]!.color;
    detail=`通算チーム戦績 / ${seasonName(roster.season)}所属選手`;
    metric=`${summary.matches}試合 · ${summary.wins}勝 ${summary.draws}分 ${summary.losses}敗 · 優勝${summary.titles}回`;
    eyebrow='TEAM SUMMARY';entity={kind:'team',stats:summary,roster};
  } else if(view==='player') {
    const pl=person(id)!, latest=pl.history.at(-1)!, summary=playerSummary(id,matches);
    p.set('summaryVersion',summaryVersion);title=pl.name;
    const affiliation=`${seasonName(latest.season)}所属 · ${teamName(latest.team,latest.season)}`;
    detail=`通算個人成績 / ${affiliation}`;
    metric=`${summary.matches}試合出場 · Single ${summary.wins}勝 ${summary.draws}分 ${summary.losses}敗（${summary.songs}楽曲） · 勝率${summary.rate===null?'—':summary.rate+'%'}（引分除外） · Duo個人1位 ${summary.firsts}/${summary.duoSongs}楽曲`;
    eyebrow='PLAYER SUMMARY';color=palette[latest.team]?.color||color;entity={kind:'player',stats:summary,portrait:portraitFor(id),affiliation};
  } else if(view==='versus') {
    const a=get('a','O4MA.'),b=get('b','HIBIKI');if(a===b)throw new RangeError('Choose two players');p.set('a',a);p.set('b',b);
    title=`${a} vs ${b}`;eyebrow='HEAD TO HEAD';
    const format=get('vsFormat');detail=`${label(get('vsSeason'))} / ${format==='tag'?'DUO × DUO':format==='single'?'SINGLE':'SINGLE + DUO'}`;
    const partners=[get('partnerA'),get('partnerB')];metric=partners.some(x=>x!=='all')?`パートナー：${partners.map(x=>x==='all'?'指定なし':x).join(' / ')}`:'個人EX SCORE比較 · Duoペア得点は別集計';
  } else if(view==='players') {title='選手一覧';detail=`${label(get('playerSeason'))} / ${get('playerTeam')==='all'?'全チーム':teams[get('playerTeam')]!.name}`;metric='出場・登録選手';eyebrow='PLAYERS';}
  else if(view==='teams'){title='チーム一覧';metric='所属選手・過去戦績';eyebrow='TEAMS';}
  else {title='記録について';metric='集計方法・公式出典';eyebrow='SOURCES';}
  if(hidden&&['team','player','seasons','versus'].includes(view))detail+=' / S6結果非表示';
  return {params:p,matrix,entity,summaryRevision,view,id,title,detail,metric,eyebrow,color,score,left,right,description:`${title}。${detail}。${metric}。STEPWIREの非公式BPL DDR戦績アーカイブ。`};
}
export function escapeHtml(value:string) {return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
