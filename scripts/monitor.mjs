import {pathToFileURL} from 'node:url';

export async function verificar(web,api,carregar=fetch){
  async function obter(url,method='GET'){
    const destino=new URL(url);
    if(destino.protocol!=='https:' || destino.username || destino.password)throw Error('URL pública HTTPS inválida');
    const r=await carregar(url,{method,redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error('HTTP '+r.status);
    return r;
  }
  const pagina=await (await obter(web)).text();
  const script=pagina.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/i);
  if(!pagina.includes('id="root"') || !script)throw Error('Página React ausente');
  const bundle=new URL(script[1],web);
  if(bundle.origin!==new URL(web).origin)throw Error('Origem inesperada do bundle');
  const recurso=await obter(bundle,'HEAD');
  if(!/javascript/i.test(recurso.headers.get('content-type')||''))throw Error('Bundle indisponível');
  const status=await (await obter(api)).json();
  if(status.situacao!=='ok' || status.servico!=='api')throw Error('Readiness da API inválida');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const inicio=Date.now();
  try{
    await verificar(process.env.PUBLIC_WEB_URL,process.env.PUBLIC_HEALTH_URL);
    console.log(new Date().toISOString(),'OK React/Nginx, JS, Express/PostgreSQL',Date.now()-inicio,'ms');
  }catch(e){console.error(new Date().toISOString(),'Falha na sonda:',e.message);process.exitCode=1}
}
