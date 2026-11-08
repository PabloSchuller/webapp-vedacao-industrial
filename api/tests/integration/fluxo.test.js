// Somente contra docker-compose.test.yml; jamais usar credenciais do banco real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
const base='http://127.0.0.1:3001';
if(!process.env.DATABASE_URL?.includes('/vedacao_test?'))throw new Error('Teste restrito ao banco vedacao_test.');
async function req(path,{token,body,method='GET',status=200,url=base,raw}={}){
  const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:raw??(body===undefined?undefined:JSON.stringify(body))});
  const text=await r.text();
  assert.equal(r.status,status,`${method} ${path}: ${text}`);
  try{return JSON.parse(text)}catch{return text}
}
const login=(email,senha)=>req('/auth/login',{method:'POST',body:{email,senha}});
test('cadastro, visitas, revisão, evidências, permissões e indisponibilidade',async t=>{
  let dono,funcionario,usuario,galpao,visita;
  const unique=Date.now();
  const senha=crypto.randomUUID(); const senhaNova=crypto.randomUUID();
  const email=`teste${unique}@example.invalid`;
  const dados={nome:`Galpão teste ${unique}`,cliente:'Cliente fictício',endereco:'Rua de teste 123, cidade fictícia',dataInicio:'2026-01-01',latitude:-26.485,longitude:-49.066};
  await t.test('saúde, autenticação e JSON inválido',async()=>{
    assert.equal((await req('/saude')).situacao,'ok');
    await req('/galpoes',{status:401});
    await req('/auth/login',{method:'POST',raw:'{',status:400});
    dono=(await login('dono@demo.local',process.env.DEMO_OWNER_PASSWORD)).token;
    assert.equal((await req('/auth/me',{token:dono})).papel,'DONO');
  });
  await t.test('cadastro de funcionário e proibição de escalada de privilégios',async()=>{
    usuario=await req('/usuarios',{token:dono,method:'POST',status:201,body:{nome:'Pessoa teste',email,senha}});
    funcionario=(await login(email,senha)).token;
    await req('/usuarios',{token:funcionario,status:403});
    await req('/usuarios',{token:dono,method:'POST',status:403,body:{nome:'Dono indevido',email:`dono${email}`,senha,papel:'DONO'}});
  });
  await t.test('cadastro, leitura e edição de galpão; data e coordenadas inválidas',async()=>{
    await req('/galpoes',{token:funcionario,method:'POST',body:{...dados,dataInicio:'2026-02-30'},status:400});
    await req('/galpoes',{token:funcionario,method:'POST',body:{...dados,longitude:null},status:400});
    galpao=await req('/galpoes',{token:funcionario,method:'POST',body:dados,status:201});
    await req(`/galpoes/${galpao.id}`,{token:funcionario,method:'PATCH',body:{...dados,status:'PAUSADA'},status:403});
    await req(`/galpoes/${galpao.id}`,{token:dono,method:'PATCH',body:{...dados,status:'EM_ANDAMENTO'}});
    assert.equal((await req(`/galpoes/${galpao.id}`,{token:dono})).progressoAtual,0);
  });
  const registro=()=>({galpaoId:galpao.id,dataVisita:'2026-01-02',descricao:'Nenhuma atividade foi realizada por falta de materiais.',progressoDepois:40});
  await t.test('validação real Node → scikit-learn e bloqueio objetivo',async()=>{
    const r=await req('/visitas/validar',{token:funcionario,method:'POST',body:registro()});
    assert.ok(r.iaClasse);assert.ok(r.iaVersao);assert.equal(r.status,'REVISAR');
    await req('/visitas',{token:funcionario,method:'POST',body:{...registro(),dataVisita:'2025-12-31'},status:422});
  });
  await t.test('visita pendente não altera progresso e impede nova visita/arquivamento',async()=>{
    visita=(await req('/visitas',{token:funcionario,method:'POST',body:registro(),status:201})).visita;
    assert.equal(visita.revisao,'PENDENTE');
    assert.equal((await req(`/galpoes/${galpao.id}`,{token:dono})).progressoAtual,0);
    await req('/visitas',{token:funcionario,method:'POST',body:registro(),status:409});
    await req(`/galpoes/${galpao.id}`,{token:dono,method:'DELETE',body:{motivo:'Teste de bloqueio'},status:409});
  });
  await t.test('revisão exclusiva do dono, aplicação única e regressão bloqueada',async()=>{
    const body={decisao:'APROVAR',comentario:'Revisão sintética de teste'};
    await req(`/visitas/${visita.id}/revisar`,{token:funcionario,method:'PATCH',body,status:403});
    await req(`/visitas/${visita.id}/revisar`,{token:dono,method:'PATCH',body});
    await req(`/visitas/${visita.id}/revisar`,{token:dono,method:'PATCH',body,status:409});
    assert.equal((await req(`/galpoes/${galpao.id}`,{token:dono})).progressoAtual,40);
    await req('/visitas',{token:funcionario,method:'POST',body:{...registro(),progressoDepois:10},status:422});
  });
  await t.test('fotos, rótulos, CSV, relatório e auditoria',async()=>{
    const foto=await req(`/visitas/${visita.id}/fotos`,{token:funcionario,method:'POST',status:201,body:{nome:'teste.png',mime:'image/png',dadosBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='}});
    const arquivo=await fetch(base+`/fotos/${foto.id}/arquivo`,{headers:{Authorization:`Bearer ${dono}`}});
    assert.equal(arquivo.status,200);assert.equal(arquivo.headers.get('content-type'),'image/png');
    await req(`/fotos/${foto.id}/arquivo`,{status:401});
    await req(`/visitas/${visita.id}/rotulo`,{token:dono,method:'PUT',body:{classe:'SEM_EXECUCAO'}});
    assert.match(await req('/relatorios/relatos_rotulados.csv',{token:dono}),/SEM_EXECUCAO/);
    assert.match(await req('/relatorios/visitas.csv',{token:dono}),/Cliente fictício/);
    assert.match(await req(`/relatorios/galpoes/${galpao.id}/imprimir`,{token:dono}),/Histórico de obra/);
    assert.ok((await req(`/galpoes/${galpao.id}/auditoria`,{token:dono})).length>=4);
  });
  await t.test('arquivamento reversível preserva visitas e evidências',async()=>{
    await req(`/galpoes/${galpao.id}`,{token:dono,method:'DELETE',body:{motivo:'Teste reversível'}});
    await req(`/galpoes/${galpao.id}`,{token:dono,status:404});
    await req(`/galpoes/${galpao.id}/restaurar`,{token:dono,method:'PATCH'});
    assert.equal((await req(`/galpoes/${galpao.id}`,{token:dono})).visitas.length,1);
    assert.equal((await req(`/visitas/${visita.id}/fotos`,{token:dono})).length,1);
  });
  await t.test('desativar e reativar funcionário não ressuscita token antigo',async()=>{
    await req(`/usuarios/${usuario.id}/ativo`,{token:dono,method:'PATCH',body:{ativo:false}});
    await req('/auth/me',{token:funcionario,status:401});
    await req(`/usuarios/${usuario.id}/ativo`,{token:dono,method:'PATCH',body:{ativo:true}});
    await req('/auth/me',{token:funcionario,status:401});
    funcionario=(await login(email,senha)).token;
  });
  await t.test('troca de senha invalida sessão e permite novo login',async()=>{
    await req('/auth/senha',{token:funcionario,method:'PATCH',body:{senhaAtual:senha,senhaNova:senhaNova}});
    await req('/auth/me',{token:funcionario,status:401});
    funcionario=(await login(email,senhaNova)).token;
  });
  await t.test('IA fora do ar mantém visita pendente; rejeição não altera progresso',async()=>{
    const child=spawn(process.execPath,['tests/servidor-cobertura.mjs'],{env:{...process.env,PORT:'3002',IA_URL:'http://127.0.0.1:1'},stdio:'ignore'});
    try{
      const url='http://127.0.0.1:3002';
      for(let i=0;i<50;i++){try{if((await fetch(url+'/saude')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
      const r=await req('/visitas',{url,token:funcionario,method:'POST',body:{...registro(),dataVisita:'2026-01-03',progressoDepois:50},status:201});
      assert.equal(r.visita.revisao,'PENDENTE');assert.equal(r.visita.iaClasse,null);
      assert.ok(r.validacao.avisos.some(a=>a.includes('indisponível')));
      await req(`/visitas/${r.visita.id}/revisar`,{token:dono,method:'PATCH',body:{decisao:'REJEITAR',comentario:'Teste de rejeição'}});
      assert.equal((await req(`/galpoes/${galpao.id}`,{token:dono})).progressoAtual,40);
    }finally{child.kill();}
  });
  await t.test('concorrência: não salva visita antiga validada antes de outra visita aprovada',async()=>{
    const g=await req('/galpoes',{token:dono,method:'POST',status:201,body:{...dados,nome:`Concorrência ${unique}`}});
    let liberar,recebeu;
    const espera=new Promise(r=>{liberar=r}),chegou=new Promise(r=>{recebeu=r});
    const mock=createServer(async(_req,res)=>{
      recebeu();await espera;
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({classificacao_ia:'SEM_EXECUCAO',score_modelo:0.9,versao_modelo:'mock-concorrencia',avisos:[]}));
    });
    await new Promise(r=>mock.listen(3004,'127.0.0.1',r));
    const child=spawn(process.execPath,['tests/servidor-cobertura.mjs'],{env:{...process.env,PORT:'3003',IA_URL:'http://127.0.0.1:3004'},stdio:'ignore'});
    try{
      const url='http://127.0.0.1:3003';
      for(let i=0;i<50;i++){try{if((await fetch(url+'/saude')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
      const body={...registro(),galpaoId:g.id,progressoDepois:0};
      const antiga=fetch(url+'/visitas',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${dono}`},body:JSON.stringify(body)});
      await chegou;
      const nova=await req('/visitas',{token:dono,method:'POST',status:201,body:{...body,dataVisita:'2026-01-03'}});
      assert.equal(nova.visita.revisao,'APROVADA');
      liberar();
      assert.ok([409,422].includes((await antiga).status));
      assert.equal((await req(`/galpoes/${g.id}`,{token:dono})).visitas.length,1);
    }finally{liberar();child.kill();await new Promise(r=>mock.close(r));}
  });
});

test('registro físico persiste quantidades, motivo e revisão sem alterar a medição legada', async () => {
  const {token} = await login('dono@demo.local',process.env.DEMO_OWNER_PASSWORD);
  const g = await req('/galpoes',{token,method:'POST',status:201,body:{
    nome:'Galpão físico '+Date.now(), cliente:'Empresa de teste', endereco:'Endereço de teste 123',
    dataInicio:'2026-01-01', latitude:-26, longitude:-49
  }});
  const descricao = 'Aplicado selante nas juntas laterais e executada a vedação.';
  const registroFisico = {situacao:'TRABALHO_EXECUTADO', servicos:[{nome:'Limpeza das gretas'},{nome:'Aplicação de P.U.'}],
    materiaisUtilizados:[{nome:'Selante',quantidade:1.5}], materiaisRestantes:[{nome:'Placa',quantidade:0}],
    materiaisNecessarios:[{nome:'Viga',quantidade:3}]};
  const body = {galpaoId:g.id, dataVisita:'2026-01-02', descricao, registroFisico, gpsLatitude:0, gpsLongitude:0};
  const post = (data,status) => req('/visitas',{token,method:'POST',status,body:data});
  for (const alteracao of [
    {servicos:[{nome:'  '}]}, {servicos:[{nome:'Placa',quantidade:1}]},
    {materiaisRestantes:[{nome:'Placa',quantidade:-1}]}, {materiaisUtilizados:[{nome:'Selante'}]},
    {materiaisNecessarios:[{nome:'',quantidade:1}]}, {materiaisUtilizados:[{nome:'Selante',quantidade:0}]},
    {situacao:'SEM_EXECUCAO'}, {situacao:'INDEFINIDO'}
  ]) await post({...body,registroFisico:{...registroFisico,...alteracao}},400);
  await post({...body,progressoDepois:40},400);
  const pre = await req('/visitas/validar',{token,method:'POST',body});
  assert.ok(pre.iaClasse);
  assert.equal(pre.progressoAntes,null);
  const apenasRelato = await req('/visitas/validar',{token,method:'POST',
    body:{...body,registroFisico:{situacao:'TRABALHO_EXECUTADO'}}});
  assert.ok(apenasRelato.iaClasse);
  const {visita} = await post(body,201);
  assert.equal(visita.revisao,'PENDENTE');
  await req('/visitas/'+visita.id+'/revisar',{token,method:'PATCH',body:{decisao:'APROVAR',comentario:'Medição conferida'}});
  const motivo = 'Entrega de placas atrasada, equipe aguardou no local.';
  const semServico = {situacao:'SEM_EXECUCAO',motivo};
  const sem = await post({...body,dataVisita:'2026-01-03',descricao:motivo,registroFisico:semServico},201);
  if (sem.visita.revisao === 'PENDENTE')
    await req('/visitas/'+sem.visita.id+'/revisar',{token,method:'PATCH',body:{decisao:'APROVAR',comentario:'Motivo conferido'}});
  await post({...body,dataVisita:'2026-01-02'},422);
  const indef = await post({...body,dataVisita:'2026-01-04',descricao:'Equipe realizou vistoria para conferir a situação.',registroFisico:{situacao:'INDEFINIDO'}},201);
  const detalhe = await req('/galpoes/'+g.id,{token});
  const salva = detalhe.visitas.find(v => v.id === visita.id);
  assert.deepEqual(salva.registroFisico,registroFisico);
  assert.equal(salva.progressoAntes,null);
  assert.equal(salva.progressoDepois,null);
  assert.equal(detalhe.progressoAtual,g.progressoAtual);
  assert.equal(detalhe.status,g.status);
  assert.equal(detalhe.visitas.find(v => v.id === sem.visita.id).registroFisico.motivo,motivo);
  assert.equal(indef.visita.registroFisico.situacao,'INDEFINIDO');
  const csv = await req('/relatorios/visitas.csv',{token});
  assert.ok(csv.includes('registro_fisico_json') && csv.includes('Limpeza das gretas'));
  const html = await req('/relatorios/galpoes/'+g.id+'/imprimir',{token});
  assert.ok(html.includes('Limpeza das gretas') && html.includes('Selante — 1.5') && html.includes(motivo));
});
