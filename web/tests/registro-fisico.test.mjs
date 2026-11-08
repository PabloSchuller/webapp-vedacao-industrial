import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('formulário e histórico distinguem execução, impedimento e medição antiga', async () => {
  const server = await createServer({server:{middlewareMode:true, hmr:false}, appType:'custom'});
  try {
    const {CamposFisicos, HistoricoFisico, novoRegistro} = await server.ssrLoadModule('/src/RegistroFisico.jsx');
    const render = (componente, props) => renderToStaticMarkup(React.createElement(componente,props));
    const registro = novoRegistro();
    assert.match(render(CamposFisicos,{registro}), /Adicionar serviço/);
    registro.situacao = 'SEM_EXECUCAO';
    registro.motivo = 'Faltaram pilares de apoio';
    registro.materiaisRestantes = [{nome:'Vigas',quantidade:0,unidade:'un'}];
    assert.doesNotMatch(render(CamposFisicos,{registro}), /Adicionar serviço/);
    const html = render(HistoricoFisico,{visita:{registroFisico:registro}});
    assert.match(html,/Faltaram pilares de apoio/);
    assert.match(html,/Vigas — 0 un/);
    assert.doesNotMatch(html,/%/);
    assert.match(render(HistoricoFisico,{visita:{progressoAntes:0,progressoDepois:25}}),/0% → 25%/);
  } finally {
    await server.close();
  }
});
