import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {criarGeocodificador} from '../src/geografia.js';
const result=[{lat:'-26.5',lon:'-49.1',display_name:'Endereço público de teste'}];
function fixture(response=result){
  let clock=0;const calls=[];
  const geo=criarGeocodificador({now:()=>clock,sleep:async ms=>{clock+=ms},fetcher:async(url,options)=>{calls.push({time:clock,url,options});return {ok:true,json:async()=>response}}});
  return {geo,calls,advance:ms=>{clock+=ms}};
}
 test('Nominatim: fila global >=1 segundo, identificação e deduplicação concorrente',async()=>{
  const {geo,calls}=fixture();const [a,b]=await Promise.all([geo('Rua A'),geo(' rua a '),geo('Rua B'),geo('Rua C')]);
  assert.deepEqual(a,b);assert.equal(a.latitude,-26.5);assert.equal(calls.length,3);
  assert.ok(calls[1].time-calls[0].time>=1000);assert.ok(calls[2].time-calls[1].time>=1000);
  assert.match(calls[0].options.headers['User-Agent'],/VedacaoHub/);assert.equal(calls[0].url.hostname,'nominatim.openstreetmap.org');
 });
 test('Nominatim: cache positivo e negativo de 24 horas',async()=>{
  for(const response of [result,[]]){const {geo,calls,advance}=fixture(response);await geo('Rua A');await geo('Rua A');assert.equal(calls.length,1);advance(86400001);await geo('Rua A');assert.equal(calls.length,2);}
 });
 test('Nominatim: cache em disco reutilizado por uma nova instância',async()=>{
  const cacheFile=join(mkdtempSync(join(tmpdir(),'geo-test-')),'cache.json');
  await criarGeocodificador({cacheFile,fetcher:async()=>({ok:true,json:async()=>result})})('Rua A');
  assert.equal(JSON.parse(readFileSync(cacheFile))[0][1].valor.latitude,-26.5);
  const value=await criarGeocodificador({cacheFile,fetcher:()=>{throw Error('Não deve consultar rede')}})('Rua A');assert.equal(value.longitude,-49.1);
 });
 test('Nominatim: falhas HTTP, rede, timeout e respostas inválidas não vazam detalhes',async()=>{
  for(const [fetcher,code] of [[async()=>({ok:false,status:403}),'UNAVAILABLE'],[async()=>{throw new Error('segredo')},'NETWORK'],[async()=>{throw Object.assign(new Error('segredo'),{name:'TimeoutError'})},'TIMEOUT'],[async()=>({ok:true,json:async()=>({})}),'INVALID'],[async()=>({ok:true,json:async()=>[{lat:91,lon:0,display_name:'x'}]}),'INVALID']]){
    await assert.rejects(criarGeocodificador({fetcher})('Rua A'),e=>e.publicCode===`GEOCODING_${code}`&&!e.message.includes('segredo'));
  }
 });
 test('Nominatim: 429 aplica pausa e rejeita excesso de fila',async()=>{
  let calls=0;const geo=criarGeocodificador({fetcher:async()=>{calls++;return {ok:false,status:429}}});
  await assert.rejects(geo('Rua A'),{publicCode:'GEOCODING_BUSY'});await assert.rejects(geo('Rua B'),{publicCode:'GEOCODING_BUSY'});assert.equal(calls,1);
  const busy=criarGeocodificador({fetcher:()=>new Promise(()=>{})});for(let i=0;i<10;i++)void busy(`Rua ${i}`);await assert.rejects(busy('Rua excedente'),{publicCode:'GEOCODING_BUSY'});
 });
