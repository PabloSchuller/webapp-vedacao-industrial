import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
function erro(code) {
  const messages={BUSY:'Busca ocupada. Aguarde um minuto e tente novamente.',NETWORK:'Não foi possível conectar à busca de endereços. Tente novamente.',TIMEOUT:'A busca de endereços demorou a responder. Tente novamente.',UNAVAILABLE:'Busca de endereços temporariamente indisponível. Você pode selecionar o ponto no mapa.',INVALID:'Resposta inválida do serviço de endereços.'};
  return Object.assign(new Error(messages[code]),{httpStatus:code==='TIMEOUT'?504:503,publicCode:`GEOCODING_${code}`});
}
// Uma única instância atende toda a aplicação com o provedor público.
export function criarGeocodificador({fetcher=globalThis.fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),baseUrl='https://nominatim.openstreetmap.org',userAgent='VedacaoHub/4.2 (cadastro de obras; uso interativo)',cacheFile}={}) {
  const cache=new Map(),pending=new Map();let queue=Promise.resolve(),lastStart=-Infinity,cooldown=0;
  if(cacheFile)try{for(const [key,value] of JSON.parse(readFileSync(cacheFile,'utf8')))cache.set(key,value);}catch{/* Cache ausente ou inválido: reconstruir. */}
  function persist(){
    if(!cacheFile)return;
    try{mkdirSync(dirname(cacheFile),{recursive:true});writeFileSync(`${cacheFile}.tmp`,JSON.stringify([...cache]),{mode:0o600});renameSync(`${cacheFile}.tmp`,cacheFile);}catch{console.warn('Cache de geocodificação não pôde ser persistido. Verifique o volume de cache.');}
  }
  return function geocodificar(endereco){
    const key=endereco.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
    const hit=cache.get(key);
    if(hit&&now()-hit.timestamp<86400000)return Promise.resolve(hit.valor);
    if(pending.has(key))return pending.get(key);
    if(pending.size>=10||now()<cooldown)return Promise.reject(erro('BUSY'));
    const task=queue.then(async()=>{
      if(now()<cooldown)throw erro('BUSY');
      const delay=1100-(now()-lastStart);if(delay>0)await sleep(delay);
      lastStart=now();
      const url=new URL('search',baseUrl.replace(/\/?$/,'/'));
      url.search=new URLSearchParams({q:endereco.trim(),format:'jsonv2',limit:'1','accept-language':'pt-BR'});
      let data;
      try{
        const response=await fetcher(url,{headers:{'User-Agent':userAgent,Accept:'application/json'},signal:AbortSignal.timeout(8000)});
        if(response.status===429){cooldown=now()+60000;throw erro('BUSY');}
        if(!response.ok)throw erro('UNAVAILABLE');
        data=await response.json();
      }catch(e){if(e.publicCode)throw e;throw erro(['AbortError','TimeoutError'].includes(e.name)?'TIMEOUT':'NETWORK');}
      if(!Array.isArray(data))throw erro('INVALID');
      let valor=null;
      if(data.length){
        const r=data[0],latitude=Number(r.lat),longitude=Number(r.lon);
        if(r.lat==null||r.lon==null||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||typeof r.display_name!=='string')throw erro('INVALID');
        valor={latitude,longitude,enderecoFormatado:r.display_name,precisao:'aproximada',provedor:'OpenStreetMap / Nominatim'};
      }
      cache.set(key,{timestamp:now(),valor});if(cache.size>500)cache.delete(cache.keys().next().value);persist();
      return valor;
    });
    pending.set(key,task);queue=task.catch(()=>{});
    task.then(()=>pending.delete(key),()=>pending.delete(key));return task;
  };
}
export const geocodificar=criarGeocodificador({baseUrl:process.env.NOMINATIM_URL||'https://nominatim.openstreetmap.org',userAgent:process.env.NOMINATIM_USER_AGENT||'VedacaoHub/4.2 (cadastro de obras; uso interativo)',cacheFile:process.env.NOMINATIM_CACHE_FILE||'/tmp/vedacaohub-nominatim.json'});
