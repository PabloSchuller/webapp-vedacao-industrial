import React from 'react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {App} from '../src/main.jsx';
import {CamposFisicos,HistoricoFisico,novoRegistro} from '../src/RegistroFisico.jsx';

beforeEach(()=>{sessionStorage.clear(); window.location.hash=''; window.scrollTo=vi.fn()});
afterEach(()=>{cleanup(); vi.unstubAllGlobals()});

test('login inválido mantém o formulário e login válido abre o painel e permite sair',async()=>{
  let autorizado=false;
  const chamadas=[];
  vi.stubGlobal('fetch',vi.fn(async(url,options)=>{
    const path=new URL(url,'http://localhost').pathname;
    chamadas.push(path);
    if(path==='/auth/login'){
      expect(JSON.parse(options.body).email).toBe('teste@example.invalid');
      return Response.json(autorizado?{token:sessaoTeste(),usuario:{nome:'Equipe',papel:'DONO'}}:{erro:'Credenciais inválidas'},{status:autorizado?200:401});
    }
    if(path==='/indicadores') return Response.json({total:0,concluidos:0,pendentes:0,ultimas:[]});
    if(path==='/galpoes') return Response.json([]);
    throw Error(path);
  }));
  render(<App/>);
  fireEvent.change(screen.getByLabelText('E-mail'),{target:{value:'teste@example.invalid'}});
  fireEvent.change(screen.getByLabelText('Senha'),{target:{value:'apenas-fixture'}});
  fireEvent.click(screen.getByText('Entrar no sistema'));
  await screen.findByText('Credenciais inválidas');
  autorizado=true;
  fireEvent.click(screen.getByText('Entrar no sistema'));
  await screen.findByText('Painel de obras');
  expect(chamadas).toContain('/indicadores');
  fireEvent.click(screen.getByText('Sair da conta'));
  await screen.findByText('Acesse sua conta');
  expect(sessionStorage.getItem('vedacao_session')).toBeNull();
});

test('equipe registra quantidade fracionária com unidade e consulta o histórico',()=>{
  function Tela(){
    const [registro,setRegistro]=React.useState(novoRegistro);
    return <><CamposFisicos registro={registro} onChange={setRegistro}/><aside aria-label="Histórico"><HistoricoFisico visita={{registroFisico:registro}}/></aside></>;
  }
  render(<Tela/>);
  fireEvent.click(screen.getByText('Adicionar serviço'));
  fireEvent.change(screen.getByLabelText('Nome'),{target:{value:'Parede leste'}});
  fireEvent.change(screen.getByLabelText('Quantidade'),{target:{value:'2.5'}});
  fireEvent.change(screen.getByLabelText('Unidade'),{target:{value:'m²'}});
  expect(within(screen.getByLabelText('Histórico')).getByText('Parede leste — 2.5 m²')).toBeTruthy();
  fireEvent.click(screen.getByText('Remover'));
  expect(screen.queryByText('Parede leste — 2.5 m²')).toBeNull();
});

function sessaoTeste(){
  return ['teste',btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})),'teste'].join('.');
}

test('visita sem execução envia o motivo, recarrega o histórico',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  const usuario={nome:'Técnico',papel:'FUNCIONARIO',id:'tecnico'};
  sessionStorage.setItem('vedacao_session',JSON.stringify({token:sessaoTeste(),usuario}));
  window.location.hash='#/detalhe/'+id;
  const g={id,nome:'Galpão de ensaio',cliente:'Cliente de teste',endereco:'Rua de teste',
    dataInicio:'2026-01-01',criadoEm:'2026-01-01',status:'PLANEJADA',visitas:[]};
  let enviado;
  vi.stubGlobal('fetch',vi.fn(async(url,options)=>{
    const path=new URL(url,'http://localhost').pathname;
    if(path==='/galpoes/'+id)return Response.json(g);
    if(path==='/visitas'){
      enviado=JSON.parse(options.body);
      g.visitas=[{...enviado,id:'visita',autor:usuario,autorId:usuario.id,revisao:'APROVADA'}];
      return Response.json({visita:g.visitas[0]},{status:201});
    }
    if(path==='/visitas/visita/fotos')return Response.json([]);
    throw Error(path);
  }));
  render(<App/>);
  fireEvent.click(await screen.findByText('Registrar visita'));
  fireEvent.change(screen.getByLabelText('Situação da visita'),{target:{value:'SEM_EXECUCAO'}});
  fireEvent.change(screen.getByLabelText(/Motivo da ausência/),{target:{value:'Entrega de placas atrasada'}});
  fireEvent.click(screen.getByText('Salvar visita'));
  await screen.findByText(/Motivo: Entrega de placas atrasada/);
  expect(enviado.registroFisico.motivo).toBe(enviado.descricao);
  expect(enviado.progressoDepois).toBeUndefined();
  expect(screen.queryByText('Editar galpão')).toBeNull();
});
