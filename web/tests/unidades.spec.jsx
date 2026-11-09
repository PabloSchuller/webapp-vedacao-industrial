import React from 'react';
import {afterEach,expect,test,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {Login,Pendencias} from '../src/main';
import {CamposFisicos,HistoricoFisico,novoRegistro} from '../src/RegistroFisico';
import MapsPanel from '../src/MapsPanel';
import {request} from '../src/apiClient';

vi.mock('../src/apiClient',()=>({request:vi.fn(),SESSION_EXPIRED:'expirada'}));
afterEach(()=>{cleanup();vi.resetAllMocks()});

test('login entrega a sessão ao chamador apenas após autenticação',async()=>{
  const onLogin=vi.fn(), sessao={usuario:{nome:'Equipe'},token:'fixture'};
  request.mockRejectedValueOnce(Error('Sem acesso')).mockResolvedValueOnce(sessao);
  render(<Login onLogin={onLogin}/>);
  fireEvent.change(screen.getByLabelText('E-mail'),{target:{value:'teste@example.invalid'}});
  fireEvent.change(screen.getByLabelText('Senha'),{target:{value:'fixture'}});
  fireEvent.click(screen.getByText('Entrar no sistema'));
  await screen.findByText('Sem acesso');expect(onLogin).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Entrar no sistema'));
  await vi.waitFor(()=>expect(onLogin).toHaveBeenCalledWith(sessao));
});
test('revisão exige comentário e preserva o card quando a API recusa',async()=>{
  request.mockResolvedValueOnce([{id:'v',galpao:{nome:'Galpão'},autor:{nome:'Equipe'},revisao:'PENDENTE',descricao:'Vedação parcial',avisos:[]}])
    .mockRejectedValueOnce(Error('Visita já revisada'));
  render(<Pendencias token="fixture"/>);
  const aprovar=await screen.findByText('Aprovar visita');
  fireEvent.click(aprovar);expect(request).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Justificativa da revisão'),{target:{value:'Conferido'}});
  fireEvent.click(aprovar);await screen.findByText('Visita já revisada');
  expect(screen.getByText('Galpão')).toBeTruthy();
});
test('formulário emite uma alteração sem modificar os itens de entrada',()=>{
  const registro=novoRegistro(), onChange=vi.fn();
  render(<CamposFisicos registro={registro} onChange={onChange}/>);
  fireEvent.click(screen.getByText('Adicionar serviço'));
  expect(onChange.mock.calls[0][0].servicos).toEqual([{nome:''}]);expect(registro.servicos).toEqual([]);
});
test('histórico preserva quantidade zero e unidade antiga',()=>{
  render(<HistoricoFisico visita={{registroFisico:{situacao:'SEM_EXECUCAO',materiaisRestantes:[{nome:'PU',quantidade:0,unidade:'tubos'}]}}}/>);
  expect(screen.getByText('PU — 0 tubos')).toBeTruthy();
});
test('mapa de galpão sem coordenadas apresenta busca pelo endereço',()=>{
  render(<MapsPanel galpoes={[{id:'g',nome:'Obra',endereco:'Rua Sul'}]}/>);
  expect(screen.getByText('Nenhuma localização marcada.')).toBeTruthy();
  expect(screen.getByRole('link').href).toContain('Rua');
});

test('cliente HTTP encaminha sessão e propaga conflito sem encerrá-la',async()=>{
  const {createApiClient}=await vi.importActual('../src/apiClient');
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({erro:'Registro mudou'},{status:409}))
    .mockResolvedValueOnce(Response.json({erro:'Expirado'},{status:401}));
  const onUnauthorized=vi.fn();
  const client=createApiClient({baseURL:'https://api.example',fetcher,onUnauthorized});
  const options={token:'fixture',method:'PATCH',body:{comentario:'Conferido'}};
  await expect(client.request('/revisao',options)).rejects.toMatchObject({status:409,message:'Registro mudou'});
  expect(fetcher.mock.calls[0][0]).toBe('https://api.example/revisao');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture');
  expect(onUnauthorized).not.toHaveBeenCalled();
  await expect(client.request('/revisao',options)).rejects.toMatchObject({status:401});
  expect(onUnauthorized).toHaveBeenCalledWith('fixture');
});
