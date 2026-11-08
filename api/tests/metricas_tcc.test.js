import test from 'node:test';import assert from 'node:assert/strict';
import {calcularMetricas} from '../src/metricas.js';
test('sem dados não inventa metas alcançadas',()=>{const m=calcularMetricas([]);assert.equal(m.sus.pontuacaoMedia,null);assert.equal(m.tempo.meta50,null);assert.equal(m.consistencia.meta95,null)});
test('redução de 50% e SUS 100/100',()=>{const m=calcularMetricas([{tipo:'TEMPO',dados:{antesSeg:100,depoisSeg:50}},{tipo:'SUS',dados:{respostas:[5,1,5,1,5,1,5,1,5,1]}}]);assert.equal(m.tempo.reducaoPercentual,50);assert.equal(m.tempo.meta50,true);assert.equal(m.sus.pontuacaoMedia,100)});
test('consistência de 95% não atinge meta acima de 95%',()=>{const m=calcularMetricas(Array.from({length:20},(_,i)=>({tipo:'CONSISTENCIA',dados:{consistente:i<19}})));assert.equal(m.consistencia.percentual,95);assert.equal(m.consistencia.meta95,false)});
