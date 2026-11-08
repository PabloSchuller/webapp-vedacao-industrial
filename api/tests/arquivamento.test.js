import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarExclusao,verificarRestauracao} from '../src/arquivamento.js';

test('somente galpão ativo e sem pendências pode ser excluído',()=>{
  assert.equal(verificarExclusao({id:'a',excluidoEm:null},0).status,200);
});
test('exclusão de galpão inexistente retorna 404',()=>{
  assert.equal(verificarExclusao(null,0).status,404);
});
test('exclusão de galpão já excluído retorna 404',()=>{
  assert.equal(verificarExclusao({id:'a',excluidoEm:new Date()},0).status,404);
});
test('exclusão é impedida se houver visitas pendentes',()=>{
  assert.equal(verificarExclusao({id:'a',excluidoEm:null},1).status,409);
});
test('apenas galpões na lixeira podem ser restaurados',()=>{
  assert.equal(verificarRestauracao({id:'a',excluidoEm:new Date()}).status,200);
  assert.equal(verificarRestauracao({id:'a',excluidoEm:null}).status,404);
  assert.equal(verificarRestauracao(null).status,404);
});
