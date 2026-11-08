import test from 'node:test';
import assert from 'node:assert/strict';
import {validarEdicaoGalpao,combinarValidacao} from '../src/validacao.js';
import {csvCelula} from '../src/csv.js';
test('edição não pode invalidar data de visitas registradas',()=>{
  const bloqueios=validarEdicaoGalpao({progressoAtual:30},{dataInicio:'2026-11-20',status:'EM_ANDAMENTO'},'2026-11-10');
  assert.equal(bloqueios.length,1);
});
test('situação administrativa independe do percentual histórico',()=>{
  assert.equal(validarEdicaoGalpao({progressoAtual:100},{dataInicio:'2026-01-01',status:'EM_ANDAMENTO'}).length,0);
});
test('responsável pode registrar conclusão sem medição percentual',()=>{
  assert.equal(validarEdicaoGalpao({progressoAtual:50},{dataInicio:'2026-01-01',status:'CONCLUIDA'}).length,0);
});
test('edição de status válida é permitida',()=>{
  assert.deepEqual(validarEdicaoGalpao({progressoAtual:70},{dataInicio:'2026-01-01',status:'PAUSADA'},'2026-01-10'),[]);
});
test('exportação CSV não executa fórmula',()=>{
  assert.equal(csvCelula('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
  assert.equal(csvCelula('Obra\nA'),'"Obra A"');
});
test('versão da IA é preservada no resultado de validação',()=>{
  const res=combinarValidacao({bloqueios:[],avisos:[]},{classificacao_ia:'INDEFINIDO',score_modelo:0.4,versao_modelo:'teste-v2',avisos:['Revisar']},null);
  assert.equal(res.iaVersao,'teste-v2');
  assert.equal(res.status,'REVISAR');
});
