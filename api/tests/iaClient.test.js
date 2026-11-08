import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarIA} from '../src/iaClient.js';
import {combinarValidacao} from '../src/validacao.js';

test('contrato da IA aceita resposta completa e preserva versão',async()=>{
  const resposta={classificacao_ia:'SEM_EXECUCAO',score_modelo:0.9,versao_modelo:'teste',avisos:[]};
  const r=await consultarIA({descricao:'Sem trabalho hoje',progressoDepois:0},0,async()=>({ok:true,json:async()=>resposta}));
  assert.deepEqual(r,resposta);
});
test('IA inválida, erro HTTP ou falha de rede exige revisão humana',async()=>{
  for(const body of [null,{}, {avisos:[]},{classificacao_ia:'SEM_EXECUCAO',score_modelo:2,versao_modelo:'x',avisos:[]}]){
    const r=await consultarIA({},0,async()=>({ok:true,json:async()=>body}));
    assert.equal(combinarValidacao({bloqueios:[],avisos:[]},r).status,'REVISAR');
  }
  for(const fetcher of [async()=>({ok:false}),async()=>{throw new Error('rede')}]){
    assert.equal((await consultarIA({},0,fetcher)).indisponivel,true);
  }
});
