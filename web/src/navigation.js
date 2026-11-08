const pages=new Set(['dashboard','galpoes','novo','detalhe','editar','funcionarios','lixeira','pendencias']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseRoute(hash){
  const [page,id,...rest]=hash.replace(/^#\/?/,'').split('/');
  if(!pages.has(page)||rest.length||(['detalhe','editar'].includes(page)?!uuid.test(id||''):Boolean(id)))return {page:'dashboard',id:null};
  return {page,id:id||null};
}
export function routeHash(page,id){
  const route=parseRoute(`#/${page}${id?'/'+id:''}`);
  return `#/${route.page}${route.id?'/'+route.id:''}`;
}
