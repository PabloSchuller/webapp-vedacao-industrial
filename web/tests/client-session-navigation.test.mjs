import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/apiClient.js';
import {parseRoute,routeHash} from '../src/navigation.js';
import {expiresAt,canManagePhoto} from '../src/session.js';
test('401 autenticado notifica token afetado; login inválido e 403 não encerram sessão',async()=>{
  const expired=[];let status=401;
  const client=createApiClient({fetcher:async()=>new Response(JSON.stringify({erro:'Recusado'}),{status}),onUnauthorized:t=>expired.push(t)});
  await assert.rejects(client.request('/auth/login'),{status:401});assert.deepEqual(expired,[]);
  await assert.rejects(client.request('/galpoes',{token:'sessao-antiga'}),{status:401});assert.deepEqual(expired,['sessao-antiga']);
  status=403;await assert.rejects(client.request('/usuarios',{token:'sessao-atual'}),{status:403});assert.equal(expired.length,1);
});
test('cliente comum cobre respostas binárias e envia credencial somente quando informada',async()=>{
  let observed;const client=createApiClient({baseURL:'http://teste',fetcher:async(...args)=>{observed=args;return new Response('imagem')}});
  const r=await client.fetchApi('/fotos/1/arquivo',{token:'t'});assert.equal(await r.text(),'imagem');assert.equal(observed[0],'http://teste/fotos/1/arquivo');assert.equal(observed[1].headers.Authorization,'Bearer t');
  await client.fetchApi('/saude');assert.equal(observed[1].headers.Authorization,undefined);
});
test('falha de rede tem mensagem segura; cancelamento é preservado e não encerra sessão',async()=>{
  let error=new Error('segredo interno');const client=createApiClient({fetcher:async()=>{throw error},onUnauthorized:()=>assert.fail('rede não revoga sessão')});
  await assert.rejects(client.request('/galpoes',{token:'t'}),/API está indisponível/);
  error=Object.assign(new Error('Cancelado'),{name:'AbortError'});await assert.rejects(client.request('/galpoes'),{name:'AbortError'});
});
test('URL de detalhes e edição restaura página e UUID',()=>{
  const id='7e7e3d29-04f5-4bfc-ae6c-05f79aa69154';
  for(const page of ['detalhe','editar'])assert.deepEqual(parseRoute(routeHash(page,id)),{page,id});
});
test('rotas desconhecidas e identificadores inválidos retornam ao painel',()=>{
  for(const hash of ['', '#/editar','https://host/','#/detalhe/../../','#/galpoes/invalido','#/desconhecido'])assert.deepEqual(parseRoute(hash),{page:'dashboard',id:null});
});
test('expiração usa exp do JWT e falha fechada em conteúdo inválido',()=>{
  const jwt=`x.${btoa(JSON.stringify({exp:2000000000}))}.y`;assert.equal(expiresAt(jwt),2000000000000);assert.equal(expiresAt('invalido'),0);assert.equal(expiresAt('x.e30.y'),0);
});
test('ações de fotos disponíveis apenas ao dono ou autor correspondente',()=>{
  assert.equal(canManagePhoto({id:'d',papel:'DONO'},'a'),true);
  assert.equal(canManagePhoto({id:'a',papel:'FUNCIONARIO'},'a'),true);
  assert.equal(canManagePhoto({id:'b',papel:'FUNCIONARIO'},'a'),false);
  assert.equal(canManagePhoto(undefined,'a'),false);
});
