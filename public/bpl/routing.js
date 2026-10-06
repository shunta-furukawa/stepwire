// URL state is independent of the DOM so history restoration cannot inherit stale filters.
export const defaultFilters = Object.freeze({season:'all',team:'all',stage:'all',query:'',playerSeason:'all',playerTeam:'all',sort:'matches',a:'O4MA.',b:'HIBIKI',vsSeason:'all',vsFormat:'all',partnerA:'all',partnerB:'all',previewA:'',previewB:'',matrixSeason:'all',matrixFormat:'all',matrixCategory:'all',matrixStyle:'all',rosterSeason:''});
const views = new Set(['s6','preview','matrix','seasons','teams','team','players','player','versus','match','about']);
const keys = {
  s6:['previewA','previewB','matrixSeason','matrixFormat','matrixCategory','matrixStyle'],
  preview:['previewA','previewB','matrixSeason','matrixFormat','matrixCategory','matrixStyle'],
  matrix:['previewA','previewB','matrixSeason','matrixFormat','matrixCategory','matrixStyle'],
  seasons:['season','team','stage'], players:['playerSeason','playerTeam','query','sort'],
  versus:['a','b','vsSeason','vsFormat','partnerA','partnerB'], team:['rosterSeason'],
};
const decode = value => {try{return decodeURIComponent(value)}catch{return value}};
export function hashRoute(hash, filters = defaultFilters) {
  const [raw,...args] = hash.replace(/^#/,'').split('/').map(decode);
  const view = views.has(raw) ? raw : 's6';
  const next = {...filters};
  if (view==='players' && args[0]==='s6') next.playerSeason='6';
  if (view==='versus' && args[0]) {
    Object.assign(next,{a:args[0],b:args[1]||next.b,vsSeason:'all',vsFormat:'all',partnerA:'all',partnerB:'all'});
  }
  if (['preview','matrix'].includes(view)) {
    if(args[0])next.previewA=args[0];if(args[1])next.previewB=args[1];
  }
  return {view,id:['team','player','match'].includes(view)?args[0]||'':null,filters:next};
}
export function parseRoute(url, hideResults = true, hashOnly = false) {
  const q = url.searchParams, filters = {...defaultFilters};
  for(const key of Object.keys(filters))if(q.has(key))filters[key]=q.get(key);
  let route = {view:views.has(q.get('view'))?q.get('view'):'s6',id:q.get('id'),filters};
  // Old shared match links used #seasons (or their originating page) beneath the dialog.
  if(url.hash && (hashOnly || q.get('view')!=='match')) {
    const legacy = hashRoute(url.hash, filters);
    route = {...legacy,filters:{...legacy.filters}};
    // Explicit query filters beat the legacy route's convenience defaults.
    if(legacy.view===q.get('view'))for(const key of Object.keys(filters))if(q.has(key))route.filters[key]=q.get(key);
  }
  return {...route,hideResults:q.has('hideResults')?q.get('hideResults')!=='0':hideResults};
}
export function routeParams(route) {
  const p = new URLSearchParams({view:route.view,hideResults:route.hideResults?'1':'0'});
  if(['team','player','match'].includes(route.view))p.set('id',route.id||'');
  for(const key of keys[route.view]||[])if(route.filters[key]!==''&&route.filters[key]!==undefined)p.set(key,String(route.filters[key]));
  if(route.view==='matrix')p.set('matrixVersion','2');
  if(['team','player'].includes(route.view))p.set('summaryVersion','1');
  return p;
}
export function routePath(route) {return '/bpl/s?'+routeParams(route).toString()}
