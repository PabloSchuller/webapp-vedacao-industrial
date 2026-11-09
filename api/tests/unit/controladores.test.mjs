import {before, beforeEach, mock, test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';

// Invoca somente o último handler registrado para cada rota. A suíte HTTP
// separada exercita middleware, autenticação, transações reais e persistência.
const db={};
const dono={id:randomUUID(),papel:'DONO'};
let router, eventos;
before(async()=>{
  process.env.JWT_SECRET=randomUUID();
  mock.module('../../src/db.js',{namedExports:{prisma:db}});
  mock.module('../../src/iaClient.js',{namedExports:{consultarIA:async()=>({
    classificacao_ia:'TRABALHO_EXECUTADO',score_modelo:0.8,avisos:[],versao_modelo:'teste'
  })}});
  const listen=mock.method(express.application,'listen',function(){router=this._router});
  try{await import('../../src/server.js')} finally {listen.mock.restore()}
});
beforeEach(()=>{
  for(const key of Object.keys(db)) delete db[key];
  eventos=[];
  Object.assign(db,{$transaction:fn=>fn(db),auditoria:{create:({data})=>eventos.push(data)}});
});
async function chamar(method,path,{body={},id='id',usuario=dono}={}){
  const route=router.stack.find(l=>l.route?.path===path && l.route.methods[method]).route;
  const res={code:200,headers:{},status(code){this.code=code;return this},
    set(k,v){this.headers[k]=v},json(v){this.body=v},send(v){this.body=v}};
  await route.stack.at(-1).handle({body,params:{id},usuario,query:{}},res,e=>{throw e});
  return res;
}
test('arquivamento recusa pendência e registra identidade e motivo ao arquivar',async()=>{
  db.galpao={findUnique:()=>({id:'g',nome:'Sul'}),updateMany:({where,data})=>{
    assert.deepEqual(where,{id:'g',excluidoEm:null});assert.equal(data.excluidoPorId,dono.id);return {count:1}
  }};
  db.visita={count:()=>1};
  const excluir=()=>chamar('delete','/galpoes/:id',{body:{motivo:'Duplicidade'}});
  await assert.rejects(excluir(),{httpStatus:409});
  db.visita.count=()=>0;
  assert.deepEqual((await excluir()).body,{id:'g',excluido:true});
  assert.equal(eventos[0].detalhes.motivo,'Duplicidade');
});
test('restaurar exige galpão arquivado e limpa atributos de exclusão',async()=>{
  db.galpao={findUnique:()=>({id:'g',excluidoEm:new Date()}),updateMany:({data})=>{
    assert.deepEqual(data,{excluidoEm:null,motivoExclusao:null,excluidoPorId:null});return {count:1}
  }};
  await chamar('patch','/galpoes/:id/restaurar');
  assert.equal(eventos[0].acao,'RESTAURAR');
});
test('cadastro e alteração de galpão registram campos e coordenadas',async()=>{
  const body={nome:'Galpão sul',endereco:'Rua da Obra 20',cliente:'Cliente',dataInicio:'2026-01-01',status:'PLANEJADA',latitude:0,longitude:0};
  db.galpao={create:({data})=>({id:'g',...data}),findUnique:()=>({...body,id:'g',longitude:1}),update:({data})=>data};
  db.visita={findFirst:()=>null};
  assert.equal((await chamar('post','/galpoes',{body})).code,201);
  assert.equal((await chamar('patch','/galpoes/:id',{body})).body.longitude,0);
  assert.deepEqual(eventos[1].detalhes.alteracoes.longitude,{antes:1,depois:0});
});
test('validação e gravação de visita física preservam o relato sem atualizar percentual',async()=>{
  const id=randomUUID(), data=new Date('2026-01-01');
  const body={galpaoId:id,dataVisita:'2026-01-02',descricao:'Fizemos duas paredes',registroFisico:{situacao:'TRABALHO_EXECUTADO'}};
  db.galpao={findUnique:()=>({id,dataInicio:data,atualizadoEm:data,progressoAtual:15})};
  db.visita={findFirst:()=>null,create:({data})=>({...data,id:'v'})};
  assert.equal((await chamar('post','/visitas/validar',{body})).body.status,'APROVAR');
  const {body:{visita},code}=await chamar('post','/visitas',{body});
  assert.equal(code,201);assert.equal(visita.progressoAntes,null);assert.equal(visita.iaClasse,'TRABALHO_EXECUTADO');
  assert.equal(visita.descricao,body.descricao);assert.equal(eventos[0].entidadeId,'v');
  db.visita.findFirst=({where})=>where.revisao==='PENDENTE'?{id:'outra'}:null;
  await assert.rejects(chamar('post','/visitas',{body}),{httpStatus:409});
});
test('aprovação legada só escreve a revisão quando o progresso anterior confere',async()=>{
  const body={decisao:'APROVAR',comentario:'Conferido em campo'};
  db.visita={findUnique:()=>({id:'v',galpaoId:'g',revisao:'PENDENTE',progressoAntes:10,progressoDepois:20}),update:({data})=>data};
  db.galpao={findUnique:()=>({id:'g'}),updateMany:()=>({count:0})};
  await assert.rejects(chamar('patch','/visitas/:id/revisar',{body}),{httpStatus:409});
  db.galpao.updateMany=({where})=>{assert.equal(where.progressoAtual,10);return {count:1}};
  assert.equal((await chamar('patch','/visitas/:id/revisar',{body})).body.revisorId,dono.id);
  assert.equal(eventos[0].acao,'APROVAR');
});
test('exclusão de visita restringe status elegíveis e produz um evento após a escrita',async()=>{
  db.visita={updateMany:({where,data})=>{assert.deepEqual(where.revisao.in,['PENDENTE','REJEITADA']);
    assert.equal(where.excluidaEm,null);assert.ok(data.excluidaEm instanceof Date);return {count:1}}};
  const excluir=()=>chamar('delete','/visitas/:id',{body:{motivo:'Registro duplicado'}});
  await excluir();db.visita.updateMany=()=>({count:0});await assert.rejects(excluir(),{httpStatus:409});
  assert.deepEqual(eventos.map(e=>e.acao),['EXCLUIR']);
});
test('anexos exigem visita ativa e validam metadados ao gravar, ler e ocultar',async()=>{
  const body={nome:'amostra.png',mime:'image/png',dadosBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='};
  const visita={id:'v',galpao:{excluidoEm:null}};
  let foto;
  db.$queryRaw=()=>[{id:'v'}];db.visita={findUnique:()=>visita};
  db.fotoVisita={count:()=>0,create:({data})=>(foto={...data,id:'f',visita}),findUnique:()=>foto,
    findMany:({where})=>{assert.equal(where.excluidaEm,null);return [foto]},update:({data})=>Object.assign(foto,data)};
  assert.equal((await chamar('post','/visitas/:id/fotos',{body})).code,201);
  assert.equal((await chamar('get','/visitas/:id/fotos')).body[0].nome,body.nome);
  const arquivo=await chamar('get','/fotos/:id/arquivo');
  assert.equal(arquivo.body.toString('base64'),body.dadosBase64);assert.equal(arquivo.headers['Cache-Control'],'private, no-store');
  await chamar('delete','/fotos/:id');await assert.rejects(chamar('get','/fotos/:id/arquivo'),{httpStatus:404});
  assert.deepEqual(eventos.map(e=>e.acao),['ANEXAR_FOTO','REMOVER_FOTO']);
});
test('rótulo humano usa identidade do revisor e exportação remove visitas excluídas',async()=>{
  db.$queryRaw=()=>[{id:'v'}];db.visita={findUnique:()=>({id:'v'})};
  db.rotuloVisita={upsert:({create})=>create,findMany:({where})=>{assert.equal(where.visita.excluidaEm,null);return []}};
  const rotulo=await chamar('put','/visitas/:id/rotulo',{body:{classe:'INDEFINIDO'}});
  assert.equal(rotulo.body.usuarioId,dono.id);assert.equal(eventos[0].acao,'ROTULAR_IA');
  assert.match((await chamar('get','/relatorios/relatos_rotulados.csv')).body,/modelo_original/);
});
