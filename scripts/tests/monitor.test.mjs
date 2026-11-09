import test from 'node:test';
import assert from 'node:assert/strict';
import {verificar} from '../monitor.mjs';

const web='https://portal.example', api='https://api.example/saude';
const html='<div id="root"></div><script type="module" src="/assets/app.js"></script>';
const resposta=(s,t)=>new Response(s,{headers:{'content-type':t}});
const carregar=(pagina=html,js='application/javascript',saude={situacao:'ok',servico:'api'})=>async url=>{
  if(String(url)===web)return resposta(pagina,'text/html');
  if(String(url)===api)return Response.json(saude);
  assert.equal(String(url),'https://portal.example/assets/app.js');
  return resposta('console.log(1)',js);
};
test('verifica a página React, bundle e readiness Express/PostgreSQL',async()=>{
  await verificar(web,api,carregar());
});
test('falha em página padrão, fallback HTML para bundle e API sem readiness',async()=>{
  await assert.rejects(verificar(web,api,carregar('Welcome to nginx')));
  await assert.rejects(verificar(web,api,carregar(html,'text/html')));
  await assert.rejects(verificar(web,api,carregar(html,'application/javascript',{situacao:'erro'})));
});
test('recusa HTTP e bundle de outra origem',async()=>{
  await assert.rejects(verificar('http://portal.example',api,carregar()));
  await assert.rejects(verificar(web,api,carregar(html.replace('/assets','https://outro.example/assets'))));
});
