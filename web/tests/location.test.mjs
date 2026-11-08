import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinates,locationURL} from '../src/location.js';
test('coordenadas: aceita zero e limites, rejeita vazio, não finito e fora de faixa',()=>{
  assert.deepEqual(coordinates('0','0'),{lat:0,lng:0});assert.deepEqual(coordinates(-90,180),{lat:-90,lng:180});
  for(const pair of [[null,0],['',0],[' ',0],[NaN,0],[0,Infinity],[91,0],[0,-181]])assert.equal(coordinates(...pair),null);
});
test('rota gratuita usa coordenadas salvas ou busca com endereço codificado',()=>{
  assert.match(locationURL({latitude:0,longitude:0}),/openstreetmap.org\/directions.*route=;0,0/);
  assert.match(locationURL({endereco:'Rua A & B'}),/query=Rua%20A%20%26%20B/);
});
