import React from 'react';

const grupos = [
  ['servicos', 'Serviços executados', 'Ex.: Aplicação de P.U.'],
  ['materiaisUtilizados', 'Materiais utilizados', 'Ex.: selante'],
  ['materiaisRestantes', 'Materiais restantes', 'Ex.: placas'],
  ['materiaisNecessarios', 'Materiais necessários', 'Ex.: vigas']
];

const situacoes = {
  TRABALHO_EXECUTADO: 'Com execução',
  SEM_EXECUCAO: 'Sem execução',
  INDEFINIDO: 'Execução indefinida'
};

export const novoRegistro = () => ({
  situacao: 'TRABALHO_EXECUTADO', servicos: [], materiaisUtilizados: [],
  materiaisRestantes: [], materiaisNecessarios: []
});

function Itens({campo, titulo, exemplo, itens, onChange}) {
  const servico = campo === 'servicos';
  function editar(indice, propriedade, valor) {
    onChange(itens.map((item, i) => i === indice ? {...item, [propriedade]: valor} : item));
  }
  return <fieldset className="itens-visita">
    <legend>{titulo}</legend>
    {itens.map((item, i) => <div className={servico ? "item-visita servico" : "item-visita"} key={i}>
      <label>{servico ? 'Nome do serviço' : 'Nome'}<input value={item.nome} maxLength={160} placeholder={exemplo}
        onChange={e => editar(i, 'nome', e.target.value)}/></label>
      {!servico && <label>Quantidade<input type="number" min="0" step="any" value={item.quantidade ?? ''}
        onChange={e => editar(i, 'quantidade', e.target.value === '' ? null : e.target.valueAsNumber)}/></label>}
      <button type="button" className="btn outline" onClick={() => onChange(itens.filter((_, n) => n !== i))}>Remover</button>
    </div>)}
    <button type="button" className="btn outline" disabled={itens.length >= 100}
      onClick={() => onChange([...itens, servico ? {nome:''} : {nome:'', quantidade:null}])}>
      {campo === 'servicos' ? 'Adicionar serviço' : 'Adicionar material'}
    </button>
  </fieldset>;
}

export function CamposFisicos({registro, onChange}) {
  const alterar = (campo, valor) => onChange({...registro, [campo]:valor});
  return <>
    <label>Situação da visita<select value={registro.situacao}
      onChange={e => alterar('situacao', e.target.value)}>
      {Object.entries(situacoes).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
    </select></label>
    {grupos.filter(([campo]) => campo !== 'servicos' || registro.situacao === 'TRABALHO_EXECUTADO')
      .map(([campo, titulo, exemplo]) => <Itens key={campo} campo={campo} titulo={titulo} exemplo={exemplo}
        itens={registro[campo]} onChange={itens => alterar(campo, itens)}/>)}
  </>;
}

export function HistoricoFisico({visita}) {
  const r = visita.registroFisico;
  if (!r) return visita.progressoDepois == null ? null :
    <p>Medição histórica: {visita.progressoAntes}% → {visita.progressoDepois}%</p>;
  return <div className="registro-fisico">
    <strong>{situacoes[r.situacao]}</strong>
    {r.motivo && <p>Motivo: {r.motivo}</p>}
    {grupos.filter(([campo]) => r[campo]?.length).map(([campo, titulo]) =>
      <div key={campo}><b>{titulo}</b><ul>{r[campo].map((item, i) =>
        <li key={i}>{item.nome}{item.quantidade != null && ` — ${item.quantidade}`}{item.unidade && ` ${item.unidade}`}</li>)}</ul></div>)}
    {r.impedimentos && <p>Impedimentos: {r.impedimentos}</p>}
  </div>;
}
