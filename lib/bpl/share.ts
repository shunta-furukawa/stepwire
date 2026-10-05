import data from '../../public/bpl/data.json';
import brand from '../../public/bpl/brand.json';

const teams: Record<string, {name:string;short:string;color:string}> = data.teams;
const palette: Record<string, {color?:string}> = brand.teams;
const seasons = ['all','0','2','4','5','6'];
const stageNames: Record<string,string> = {regular:'レギュラー',quarter:'クォーターファイナル',semi:'セミファイナル',final:'ファイナル'};
const label = (s:string|number) => String(s)==='0'?'ZERO':String(s)==='all'?'全シーズン':`S${s}`;
export function shareModel(input: URLSearchParams) {
  const p = new URLSearchParams();
  const view = input.get('view') || 'seasons';
  if (!['seasons','teams','team','players','player','versus','match','about'].includes(view)) throw new RangeError('Unknown view');
  p.set('view',view);
  const person = (id:string) => data.players.find(x=>x.id===id);
  for(const key of ['id','rosterSeason','season','team','stage','query','playerSeason','playerTeam','sort','a','b','vsSeason','vsFormat','partnerA','partnerB']) {
    const value=input.get(key); if(value===null)continue;
    let valid=false;
    if(key==='id')valid=view==='match'?data.matches.some(m=>m.id===value):view==='team'?Object.hasOwn(teams,value):view==='player'?!!person(value):false;
    else if(['season','playerSeason','vsSeason','rosterSeason'].includes(key))valid=seasons.includes(value);
    else if(['team','playerTeam'].includes(key))valid=value==='all'||Object.hasOwn(teams,value);
    else if(key==='stage')valid=value==='all'||Object.hasOwn(stageNames,value);
    else if(key==='query')valid=value.length<=100;
    else if(key==='sort')valid=['matches','wins','firsts','name'].includes(value);
    else if(key==='vsFormat')valid=['all','single','tag'].includes(value);
    else valid=(key.startsWith('partner')&&value==='all')||!!person(value);
    if(!valid)throw new RangeError(`Invalid ${key}`);p.set(key,value);
  }
  const id=p.get('id')||'';
  if(['player','team','match'].includes(view)&&!id)throw new RangeError('Missing id');
  const get=(key:string,fallback='all')=>p.get(key)||fallback;
  let title='BPL DDR 戦績', detail='シーズン・チーム・選手・直接対決', metric=`${data.matches.length}試合`, eyebrow='ARCHIVE', color='#b4da46';
  let score='', left='',right='';
  if(view==='seasons') {
    const s=get('season'),t=get('team'),stage=get('stage');
    const ms=data.matches.filter(m=>(s==='all'||String(m.season)===s)&&(t==='all'||m.teams.includes(t))&&(stage==='all'||m.stage===stage));
    title=`${label(s)} · BPL DDR`;detail=[t==='all'?'全チーム':teams[t]!.name,stage==='all'?'全ステージ':stageNames[stage]].join(' / ');metric=`${ms.length}試合`;eyebrow='SEASON';
  } else if(view==='match') {
    const m=data.matches.find(m=>m.id===id)!;left=teams[m.teams[0]!]!.short;right=teams[m.teams[1]!]!.short;
    title=`${left} vs ${right}`;score=m.points.join(' — ');metric=`${m.date} · ${m.label}`;detail=`${label(m.season)} / ${stageNames[m.stage]}`;eyebrow='MATCH RESULT';
  } else if(view==='team') {
    title=teams[id]!.name;color=palette[id]?.color||teams[id]!.color;
    const ms=data.matches.filter(m=>m.teams.includes(id));metric=`${ms.length}試合`;detail=get('rosterSeason')==='all'?'全シーズンのチーム戦績・所属選手':`通算戦績 / ${label(get('rosterSeason'))}所属選手`;eyebrow='TEAM';
  } else if(view==='player') {
    const pl=person(id)!;title=pl.name;const ms=data.matches.filter(m=>m.battles.some(b=>b.players.some(ps=>ps.includes(id))));metric=`${ms.length}試合出場`;
    detail=pl.history.map(h=>label(h.season)).join(' / ');eyebrow='PLAYER';color=palette[pl.history.at(-1)!.team]?.color||color;
  } else if(view==='versus') {
    const a=get('a','O4MA.'),b=get('b','HIBIKI');if(a===b)throw new RangeError('Choose two players');p.set('a',a);p.set('b',b);
    title=`${a} vs ${b}`;eyebrow='HEAD TO HEAD';
    const format=get('vsFormat');detail=`${label(get('vsSeason'))} / ${format==='tag'?'DUO × DUO':format==='single'?'SINGLE':'SINGLE + DUO'}`;
    const partners=[get('partnerA'),get('partnerB')];metric=partners.some(x=>x!=='all')?`パートナー：${partners.map(x=>x==='all'?'指定なし':x).join(' / ')}`:'個人EX SCORE比較 · Duoペア得点は別集計';
  } else if(view==='players') {title='選手一覧';detail=`${label(get('playerSeason'))} / ${get('playerTeam')==='all'?'全チーム':teams[get('playerTeam')]!.name}`;metric='出場・登録選手';eyebrow='PLAYERS';}
  else if(view==='teams'){title='チーム一覧';metric='所属選手・過去戦績';eyebrow='TEAMS';}
  else {title='記録について';metric='集計方法・公式出典';eyebrow='SOURCES';}
  return {params:p,view,id,title,detail,metric,eyebrow,color,score,left,right,description:`${title}。${detail}。${metric}。STEPWIREの非公式BPL DDR戦績アーカイブ。`};
}
export function escapeHtml(value:string) {return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
