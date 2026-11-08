import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {ZodError} from 'zod';
import {prisma} from './db.js';
import {autenticacao, somenteDono} from './auth.js';
import {loginSchema,usuarioSchema,galpaoSchema,galpaoEdicaoSchema,alterarUsuarioSchema,exclusaoGalpaoSchema,alterarSenhaSchema,visitaSchema,revisaoSchema,dataDb,dataIso,fotoSchema,rotuloVisitaSchema,filtrosVisitaSchema} from './schemas.js';
import {validarObjetivamente,combinarValidacao,distanciaMetros,validarEdicaoGalpao} from './validacao.js';
import {csvCelula} from './csv.js';
import {verificarExclusao,verificarRestauracao} from './arquivamento.js';
import {geocodificar} from './geografia.js';
import {validarFoto,MAX_FOTOS_POR_VISITA,fotoProjection} from './fotos.js';
import {relatorioGalpao} from './relatorio.js';
import {consultarIA} from './iaClient.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres.');
const app=express();
app.use(helmet());
const origins=(process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s=>s.trim());
app.use(cors({origin:origins}));
// Limite especial apenas para envio autenticado de imagens (máximo de 3 MB decodificados).
app.use('/visitas/:id/fotos',express.json({limit:'4.5mb'}));
app.use(express.json({limit:'100kb'}));
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const parse=(schema,body)=>schema.parse(body);
const projection={id:true,nome:true,email:true,papel:true,ativo:true};
const fail=(status,msg)=>{const e=new Error(msg);e.httpStatus=status;throw e;};
const audit=(tx,userId,entidade,id,acao,detalhes)=>tx.auditoria.create({data:{usuarioId:userId,entidade,entidadeId:id,acao,detalhes}});
const isPrismaConflict=(e)=>['P2034','P2025'].includes(e.code);

app.get('/saude',asyncRoute(async(req,res)=>{
  await prisma.$queryRaw`SELECT 1`;
  res.json({situacao:'ok',servico:'api'});
}));
app.post('/auth/login',rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false}),asyncRoute(async(req,res)=>{
  const {email,senha}=parse(loginSchema,req.body);
  const usuario=await prisma.usuario.findUnique({where:{email:email.toLowerCase()}});
  if(!usuario || !usuario.ativo || !(await bcrypt.compare(senha,usuario.senhaHash))) return res.status(401).json({erro:'Credenciais incorretas.'});
  const payload={id:usuario.id,papel:usuario.papel,tokenVersao:usuario.tokenVersao};
  const token=jwt.sign(payload,process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'8h'});
  res.json({token,usuario:{id:usuario.id,nome:usuario.nome,email:usuario.email,papel:usuario.papel}});
}));
app.use(autenticacao);
app.use(asyncRoute(async(req,res,next)=>{
  const u=await prisma.usuario.findUnique({where:{id:req.usuario.id},select:{id:true,papel:true,ativo:true,tokenVersao:true}});
  if(!u?.ativo || u.tokenVersao!==req.usuario.tokenVersao) return res.status(401).json({erro:'Sessão inválida. Entre novamente.'});
  req.usuario.papel=u.papel;
  next();
}));
app.get('/auth/me',asyncRoute(async(req,res)=>res.json(await prisma.usuario.findUnique({where:{id:req.usuario.id},select:projection}))));

// Alteração de senha pelo titular; invalida automaticamente todos os tokens anteriores.
app.patch('/auth/senha',asyncRoute(async(req,res)=>{
  const d=parse(alterarSenhaSchema,req.body);
  const u=await prisma.usuario.findUnique({where:{id:req.usuario.id}});
  if(!u || !(await bcrypt.compare(d.senhaAtual,u.senhaHash))) fail(401,'Senha atual incorreta.');
  await prisma.$transaction(async tx=>{
    await tx.usuario.update({where:{id:u.id,senhaHash:u.senhaHash,tokenVersao:u.tokenVersao},data:{senhaHash:await bcrypt.hash(d.senhaNova,12),tokenVersao:{increment:1}}});
    await audit(tx,u.id,'USUARIO',u.id,'ALTERAR_SENHA',{origem:'conta'});
  });
  res.json({mensagem:'Senha alterada. Entre novamente com a nova senha.'});
}));

app.post('/usuarios',somenteDono,asyncRoute(async(req,res)=>{
  const u=parse(usuarioSchema,req.body);
  if(u.papel!=='FUNCIONARIO') fail(403,'Por esta interface só é permitido cadastrar funcionários.');
  const novo=await prisma.$transaction(async tx=>{
    const novoUsuario=await tx.usuario.create({data:{nome:u.nome,email:u.email.toLowerCase(),senhaHash:await bcrypt.hash(u.senha,12),papel:'FUNCIONARIO'},select:projection});
    await audit(tx,req.usuario.id,'USUARIO',novoUsuario.id,'CRIAR',{nome:novoUsuario.nome,papel:novoUsuario.papel});
    return novoUsuario;
  });
  res.status(201).json(novo);
}));
app.get('/usuarios',somenteDono,asyncRoute(async(req,res)=>res.json(await prisma.usuario.findMany({select:projection,orderBy:{nome:'asc'}}))));
app.patch('/usuarios/:id/ativo',somenteDono,asyncRoute(async(req,res)=>{
  const {ativo}=parse(alterarUsuarioSchema,req.body);
  const atual=await prisma.usuario.findUnique({where:{id:req.params.id}});
  if(!atual) fail(404,'Usuário não encontrado.');
  // Não permitir desativar o próprio acesso nem contas administradoras.
  if(atual.id===req.usuario.id || atual.papel==='DONO') fail(403,'Não é permitido alterar o estado do responsável.');
  const atualizado=await prisma.$transaction(async tx=>{
    const u=await tx.usuario.update({where:{id:atual.id},data:{ativo,tokenVersao:{increment:1}},select:{...projection,ativo:true}});
    await audit(tx,req.usuario.id,'USUARIO',atual.id,ativo?'ATIVAR':'DESATIVAR',{antes:atual.ativo,depois:ativo});
    return u;
  });
  res.json(atualizado);
}));



// Lixeira reversível: preserva visitas, auditoria e referências para estudo de caso.
app.get('/galpoes/excluidos',somenteDono,asyncRoute(async(req,res)=>{
  res.json(await prisma.galpao.findMany({where:{excluidoEm:{not:null}},orderBy:{excluidoEm:'desc'},include:{_count:{select:{visitas:true}}}}));
}));
app.delete('/galpoes/:id',somenteDono,asyncRoute(async(req,res)=>{
  const {motivo}=parse(exclusaoGalpaoSchema,req.body);
  const item=await prisma.$transaction(async tx=>{
    const galpao=await tx.galpao.findUnique({where:{id:req.params.id}});
    if(!galpao || galpao.excluidoEm) fail(404,'Galpão não encontrado entre os ativos.');
    const pendentes=await tx.visita.count({where:{galpaoId:galpao.id,revisao:'PENDENTE'}});
    const politica=verificarExclusao(galpao,pendentes);
    if(politica.erro) fail(politica.status,politica.erro);
    const atualizado=await tx.galpao.updateMany({where:{id:galpao.id,excluidoEm:null},data:{excluidoEm:new Date(),motivoExclusao:motivo,excluidoPorId:req.usuario.id}});
    if(atualizado.count!==1) fail(409,'Este galpão já foi excluído.');
    await audit(tx,req.usuario.id,'GALPAO',galpao.id,'EXCLUIR',{nome:galpao.nome,motivo,modo:'logico'});
    return {id:galpao.id,excluido:true};
  },{isolationLevel:'Serializable'});
  res.json(item);
}));
app.patch('/galpoes/:id/restaurar',somenteDono,asyncRoute(async(req,res)=>{
  const galpao=await prisma.$transaction(async tx=>{
    const g=await tx.galpao.findUnique({where:{id:req.params.id}});
    const politica=verificarRestauracao(g);
    if(politica.erro) fail(politica.status,politica.erro);
    const r=await tx.galpao.updateMany({where:{id:g.id,excluidoEm:{not:null}},data:{excluidoEm:null,motivoExclusao:null,excluidoPorId:null}});
    if(r.count!==1) fail(409,'Este galpão já foi restaurado.');
    await audit(tx,req.usuario.id,'GALPAO',g.id,'RESTAURAR',{nome:g.nome,motivoAnterior:g.motivoExclusao});
    return tx.galpao.findUnique({where:{id:g.id}});
  },{isolationLevel:'Serializable'});
  res.json(galpao);
}));

app.get('/galpoes',asyncRoute(async(req,res)=>{
  const galpoes=await prisma.galpao.findMany({where:{excluidoEm:null},orderBy:{atualizadoEm:'desc'},include:{_count:{select:{visitas:true}}}});
  res.json(galpoes);
}));
app.get('/galpoes/:id',asyncRoute(async(req,res)=>{
  const g=await prisma.galpao.findUnique({where:{id:req.params.id},include:{visitas:{include:{autor:{select:projection},revisor:{select:projection}},orderBy:[{dataVisita:'desc'},{criadoEm:'desc'}]}}});
  if(!g || g.excluidoEm) fail(404,'Galpão não encontrado.');
  res.json(g);
}));
app.post('/galpoes',asyncRoute(async(req,res)=>{
  const d=parse(galpaoSchema,req.body);
  const g=await prisma.$transaction(async tx=>{
    const novo=await tx.galpao.create({data:{...d,dataInicio:dataDb(d.dataInicio)}});
    await audit(tx,req.usuario.id,'GALPAO',novo.id,'CRIAR',{nome:novo.nome});
    return novo;
  });
  res.status(201).json(g);
}));
// Edição de dados cadastrais; não manipula progresso e registra cada alteração.
app.patch('/galpoes/:id',somenteDono,asyncRoute(async(req,res)=>{
  const d=parse(galpaoEdicaoSchema,req.body);
  const inicio=dataDb(d.dataInicio);
  const atualizado=await prisma.$transaction(async tx=>{
    const atual=await tx.galpao.findUnique({where:{id:req.params.id}});
    if(!atual || atual.excluidoEm) fail(404,'Galpão não encontrado.');
    const primeira=await tx.visita.findFirst({where:{galpaoId:atual.id},orderBy:{dataVisita:'asc'},select:{dataVisita:true}});
    const bloqueios=validarEdicaoGalpao(atual,d,primeira?dataIso(primeira.dataVisita):null);
    if(bloqueios.length) fail(422,bloqueios.join(' '));
    const dados={...d,dataInicio:inicio,latitude:d.latitude??null,longitude:d.longitude??null};
    const alteracoes={};
    for(const campo of ['nome','cliente','endereco','dataInicio','status','descricao','latitude','longitude']){
      const antes=campo==='dataInicio'?dataIso(atual.dataInicio):atual[campo];
      const depois=campo==='dataInicio'?d.dataInicio:dados[campo];
      if(antes!==depois) alteracoes[campo]={antes,depois};
    }
    if(!Object.keys(alteracoes).length)return atual;
    const g=await tx.galpao.update({where:{id:atual.id},data:dados});
    await audit(tx,req.usuario.id,'GALPAO',atual.id,'EDITAR',{alteracoes});
    return g;
  },{isolationLevel:'Serializable'});
  res.json(atualizado);
}));
app.get('/galpoes/:id/auditoria',somenteDono,asyncRoute(async(req,res)=>{
  const g=await prisma.galpao.findUnique({where:{id:req.params.id},select:{id:true,excluidoEm:true}});
  if(!g || g.excluidoEm) fail(404,'Galpão não encontrado.');
  const visitas=await prisma.visita.findMany({where:{galpaoId:g.id},select:{id:true}});
  const ids=visitas.map(v=>v.id);
  res.json(await prisma.auditoria.findMany({where:{OR:[{entidade:'GALPAO',entidadeId:g.id},{entidade:'VISITA',entidadeId:{in:ids}}]},orderBy:{criadoEm:'desc'},take:250,include:{usuario:{select:projection}}}));
}));

// Evidências fotográficas por visita. Dados armazenados no PostgreSQL para
// preservar fotos mesmo quando a API é recriada pelo Docker.
app.get('/visitas/:id/fotos',asyncRoute(async(req,res)=>{
  const visita=await prisma.visita.findUnique({where:{id:req.params.id},select:{id:true,galpao:{select:{excluidoEm:true}}}});
  if(!visita || (visita.galpao.excluidoEm && req.usuario.papel!=='DONO')) fail(404,'Visita não encontrada.');
  res.json(await prisma.fotoVisita.findMany({where:{visitaId:visita.id,excluidaEm:null},orderBy:{criadoEm:'desc'},select:fotoProjection}));
}));
app.post('/visitas/:id/fotos',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false}),asyncRoute(async(req,res)=>{
  const d=parse(fotoSchema,req.body);
  let dados;
  try{dados=validarFoto(d)}catch(e){fail(422,e.message)}
  const foto=await prisma.$transaction(async tx=>{
    const visita=await tx.visita.findUnique({where:{id:req.params.id},include:{galpao:{select:{excluidoEm:true}}}});
    if(!visita||visita.galpao.excluidoEm)fail(404,'Visita não encontrada ou galpão arquivado.');
    if(req.usuario.papel!=='DONO'&&visita.autorId!==req.usuario.id) fail(403,'Somente o autor ou o proprietário pode anexar evidências.');
    const quantidade=await tx.fotoVisita.count({where:{visitaId:visita.id,excluidaEm:null}});
    if(quantidade>=MAX_FOTOS_POR_VISITA)fail(409,`Limite de ${MAX_FOTOS_POR_VISITA} fotos por visita.`);
    const criado=await tx.fotoVisita.create({data:{...dados,visitaId:visita.id,autorId:req.usuario.id},select:fotoProjection});
    await audit(tx,req.usuario.id,'VISITA',visita.id,'ANEXAR_FOTO',{fotoId:criado.id,nome:criado.nome,tamanho:criado.tamanho});
    return criado;
  },{isolationLevel:'Serializable'});
  res.status(201).json(foto);
}));
app.get('/fotos/:id/arquivo',asyncRoute(async(req,res)=>{
  const foto=await prisma.fotoVisita.findUnique({where:{id:req.params.id},include:{visita:{select:{galpao:{select:{excluidoEm:true}}}}}});
  if(!foto||foto.excluidaEm||(foto.visita.galpao.excluidoEm&&req.usuario.papel!=='DONO'))fail(404,'Foto não encontrada.');
  res.set('Content-Type',foto.mime);
  res.set('Content-Disposition','inline; filename="evidencia"');
  res.set('Cache-Control','private, no-store');
  res.send(Buffer.from(foto.dados));
}));
app.delete('/fotos/:id',asyncRoute(async(req,res)=>{
  await prisma.$transaction(async tx=>{
    const foto=await tx.fotoVisita.findUnique({where:{id:req.params.id},include:{visita:{include:{galpao:{select:{excluidoEm:true}}}}}});
    if(!foto||foto.excluidaEm||foto.visita.galpao.excluidoEm)fail(404,'Foto não encontrada.');
    if(req.usuario.papel!=='DONO' && foto.autorId!==req.usuario.id)fail(403,'Sem permissão para remover esta evidência.');
    await tx.fotoVisita.update({where:{id:foto.id},data:{excluidaEm:new Date()}});
    await audit(tx,req.usuario.id,'VISITA',foto.visitaId,'REMOVER_FOTO',{fotoId:foto.id,nome:foto.nome,modo:'logico'});
  });
  res.json({mensagem:'Foto removida da visualização; evento preservado na auditoria.'});
}));

// Rotulagem manual de relatos: informação gerenciada pelo proprietário.
// Essa avaliação não muda automaticamente o modelo nem o progresso da obra.
app.get('/visitas/:id/rotulo',somenteDono,asyncRoute(async(req,res)=>{
  res.json(await prisma.rotuloVisita.findUnique({where:{visitaId:req.params.id}}));
}));
app.put('/visitas/:id/rotulo',somenteDono,asyncRoute(async(req,res)=>{
  const d=parse(rotuloVisitaSchema,req.body);
  const rotulo=await prisma.$transaction(async tx=>{
    const visita=await tx.visita.findUnique({where:{id:req.params.id},select:{id:true}});
    if(!visita)fail(404,'Visita não encontrada.');
    const r=await tx.rotuloVisita.upsert({where:{visitaId:visita.id},create:{visitaId:visita.id,usuarioId:req.usuario.id,...d},update:{...d,usuarioId:req.usuario.id}});
    await audit(tx,req.usuario.id,'VISITA',visita.id,'ROTULAR_IA',{classe:d.classe,justificativa:d.justificativa,origem:'avaliacao_humana'});
    return r;
  });
  res.json(rotulo);
}));
app.get('/relatorios/relatos_rotulados.csv',somenteDono,asyncRoute(async(req,res)=>{
  const rotulos=await prisma.rotuloVisita.findMany({
    orderBy:{criadoEm:'asc'},
    include:{visita:{include:{galpao:{select:{id:true,nome:true}}}}}
  });
  const cab=['descricao','classe','galpao_id','data_visita','modelo_original','classe_original'];
  const linhas=rotulos.map(r=>[r.visita.descricao,r.classe,r.visita.galpao.id,dataIso(r.visita.dataVisita),r.visita.iaVersao,r.visita.iaClasse]);
  const saida='\uFEFF'+[cab,...linhas].map(l=>l.map(csvCelula).join(';')).join('\r\n')+'\r\n';
  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('Content-Disposition','attachment; filename="relatos_rotulados_vedacaohub.csv"');
  res.send(saida);
}));

// Relatório imprimível do galpão. Ctrl+P no navegador gera um PDF.
app.get('/relatorios/galpoes/:id/imprimir',somenteDono,asyncRoute(async(req,res)=>{
  const g=await prisma.galpao.findUnique({where:{id:req.params.id},include:{visitas:{include:{autor:{select:{nome:true}}}}}});
  if(!g)fail(404,'Galpão não encontrado.');
  res.set('Content-Type','text/html; charset=utf-8');
  res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  res.set('Cache-Control','no-store');
  res.send(relatorioGalpao(g));
}));

app.get('/indicadores',asyncRoute(async(req,res)=>{
  const [total,concluidos,pendentes,ultimas]=await Promise.all([
    prisma.galpao.count({where:{excluidoEm:null}}),prisma.galpao.count({where:{status:'CONCLUIDA',excluidoEm:null}}),prisma.visita.count({where:{revisao:'PENDENTE',galpao:{is:{excluidoEm:null}}}}),
    prisma.visita.findMany({where:{galpao:{is:{excluidoEm:null}}},take:6,orderBy:{criadoEm:'desc'},include:{galpao:{select:{id:true,nome:true}},autor:{select:{nome:true}}}})
  ]);
  res.json({total,concluidos,pendentes,ultimas});
}));
app.get('/visitas/pendentes',somenteDono,asyncRoute(async(req,res)=>res.json(await prisma.visita.findMany({where:{revisao:'PENDENTE',galpao:{is:{excluidoEm:null}}},orderBy:{criadoEm:'asc'},include:{galpao:{select:{id:true,nome:true}},autor:{select:projection}}}))));

async function validarVisita(d,galpao) {
  const ultima=await prisma.visita.findFirst({where:{galpaoId:galpao.id,revisao:'APROVADA'},orderBy:[{dataVisita:'desc'},{criadoEm:'desc'}],select:{dataVisita:true}});
  const regras=validarObjetivamente({dataInicio:dataIso(galpao.dataInicio),dataVisita:d.dataVisita,ultimaVisita:ultima?dataIso(ultima.dataVisita):null,progressoAntes:galpao.progressoAtual,progressoDepois:d.progressoDepois,justificativa:d.justificativa});
  const ia=await consultarIA(d,galpao.progressoAtual);
  if (d.registroFisico && ia.classificacao_ia && ia.classificacao_ia !== d.registroFisico.situacao) {
    regras.avisos.push('A interpretação do relato pela IA diverge da situação informada. Confira o registro físico.');
  }
  const temGps=d.gpsLatitude!=null && d.gpsLongitude!=null && galpao.latitude!=null && galpao.longitude!=null;
  let distancia=temGps?distanciaMetros(d.gpsLatitude,d.gpsLongitude,galpao.latitude,galpao.longitude):null;
  // A validação de visitas compara o GPS com as coordenadas salvas, sem consultas externas.
  return combinarValidacao(regras,ia,distancia);
}
app.post('/visitas/validar',asyncRoute(async(req,res)=>{
  const d=parse(visitaSchema,req.body);
  dataDb(d.dataVisita);
  const galpao=await prisma.galpao.findUnique({where:{id:d.galpaoId}});
  if(!galpao || galpao.excluidoEm) fail(404,'Galpão não encontrado.');
  res.json({...await validarVisita(d,galpao),progressoAntes:d.registroFisico ? null : galpao.progressoAtual});
}));
app.post('/visitas',asyncRoute(async(req,res)=>{
  const d=parse(visitaSchema,req.body);
  const dataVisita=dataDb(d.dataVisita);
  const galpao=await prisma.galpao.findUnique({where:{id:d.galpaoId}});
  if(!galpao || galpao.excluidoEm) fail(404,'Galpão não encontrado.');
  const resultado=await validarVisita(d,galpao);
  if(resultado.status==='BLOQUEAR') return res.status(422).json({erro:'Registro bloqueado.',validacao:resultado});
  const revisao=resultado.status==='REVISAR'?'PENDENTE':'APROVADA';
  const visita=await prisma.$transaction(async tx=>{
    const pendente=await tx.visita.findFirst({where:{galpaoId:d.galpaoId,revisao:'PENDENTE'},select:{id:true}});
    if(pendente) fail(409,'Existe uma visita aguardando revisão neste galpão.');
    const atual=await tx.galpao.findUnique({where:{id:d.galpaoId}});
    if(!atual || atual.excluidoEm) fail(409,'Galpão arquivado; não é possível registrar visitas.');
    if(atual.progressoAtual!==galpao.progressoAtual) fail(409,'O progresso mudou; valide a visita novamente.');
    if(atual.atualizadoEm.getTime()!==galpao.atualizadoEm.getTime()) fail(409,'O cadastro mudou; valide a visita novamente.');
    // Releitura dentro da transação: outra visita pode manter o mesmo percentual.
    const ultima=await tx.visita.findFirst({where:{galpaoId:d.galpaoId,revisao:'APROVADA'},orderBy:[{dataVisita:'desc'},{criadoEm:'desc'}]});
    const regras=validarObjetivamente({dataInicio:dataIso(atual.dataInicio),dataVisita:d.dataVisita,ultimaVisita:ultima?dataIso(ultima.dataVisita):null,progressoAntes:atual.progressoAtual,progressoDepois:d.progressoDepois,justificativa:d.justificativa});
    if(regras.bloqueios.length) fail(422,regras.bloqueios.join(' '));
    const nova=await tx.visita.create({data:{galpaoId:d.galpaoId,autorId:req.usuario.id,dataVisita,descricao:d.descricao,registroFisico:d.registroFisico,progressoAntes:d.registroFisico ? null : galpao.progressoAtual,progressoDepois:d.progressoDepois ?? null,justificativa:d.justificativa,proximosPassos:d.proximosPassos,gpsLatitude:d.gpsLatitude,gpsLongitude:d.gpsLongitude,iaClasse:resultado.iaClasse,iaConfianca:resultado.iaConfianca,iaVersao:resultado.iaVersao,bloqueios:resultado.bloqueios,avisos:resultado.avisos,revisao}});
    if(revisao==='APROVADA' && !d.registroFisico) {
      const ok=await tx.galpao.updateMany({where:{id:d.galpaoId,progressoAtual:galpao.progressoAtual},data:{progressoAtual:d.progressoDepois,status:d.progressoDepois===100?'CONCLUIDA':'EM_ANDAMENTO'}});
      if(ok.count!==1) fail(409,'Concorrência detectada; recarregue os dados.');
    }
    await audit(tx,req.usuario.id,'VISITA',nova.id,'CRIAR',{revisao,situacao:d.registroFisico?.situacao,progressoAntes:d.registroFisico ? null : galpao.progressoAtual,progressoDepois:d.progressoDepois ?? null,avisos:resultado.avisos});
    return nova;
  },{isolationLevel:'Serializable'});
  res.status(201).json({visita,validacao:resultado});
}));
app.patch('/visitas/:id/revisar',somenteDono,asyncRoute(async(req,res)=>{
  const {decisao,comentario}=parse(revisaoSchema,req.body);
  const revisada=await prisma.$transaction(async tx=>{
    const v=await tx.visita.findUnique({where:{id:req.params.id}});
    if(!v) fail(404,'Visita não encontrada.');
    if(v.revisao!=='PENDENTE') fail(409,'Esta visita já foi revisada.');
    const galpao=await tx.galpao.findUnique({where:{id:v.galpaoId},select:{excluidoEm:true}});
    if(!galpao || galpao.excluidoEm) fail(409,'Galpão excluído; restaure antes de revisar.');
    if(decisao==='APROVAR' && v.progressoDepois != null) {
      const ok=await tx.galpao.updateMany({where:{id:v.galpaoId,progressoAtual:v.progressoAntes},data:{progressoAtual:v.progressoDepois,status:v.progressoDepois===100?'CONCLUIDA':'EM_ANDAMENTO'}});
      if(ok.count!==1) fail(409,'O progresso mudou; não é possível aprovar sem reavaliação.');
    }
    const u=await tx.visita.update({where:{id:v.id},data:{revisao:decisao==='APROVAR'?'APROVADA':'REJEITADA',comentarioRevisao:comentario,revisorId:req.usuario.id,revisadoEm:new Date()}});
    await audit(tx,req.usuario.id,'VISITA',v.id,decisao,{comentario});
    return u;
  },{isolationLevel:'Serializable'});
  res.json(revisada);
}));
// Exportação controlada de evidências para análise. Protege células contra fórmulas em planilhas.
app.get('/relatorios/visitas.csv',somenteDono,asyncRoute(async(req,res)=>{
  const visitas=await prisma.visita.findMany({orderBy:[{dataVisita:'asc'},{criadoEm:'asc'}],include:{galpao:{select:{nome:true,cliente:true}},autor:{select:{nome:true}},revisor:{select:{nome:true}}}});
  const cabecalho=['id','galpao','cliente','data_visita','autor','descricao','progresso_antes','progresso_depois','revisao','classe_ia','confianca_ia','avisos','bloqueios','revisor','comentario_revisao','proximos_passos','justificativa','registro_fisico_json'];
  const linhas=visitas.map(v=>[v.id,v.galpao.nome,v.galpao.cliente,dataIso(v.dataVisita),v.autor.nome,v.descricao,v.progressoAntes,v.progressoDepois,v.revisao,v.iaClasse,v.iaConfianca,Array.isArray(v.avisos)?v.avisos.join(' | '):'',Array.isArray(v.bloqueios)?v.bloqueios.join(' | '):'',v.revisor?.nome,v.comentarioRevisao,v.proximosPassos,v.justificativa,v.registroFisico ? JSON.stringify(v.registroFisico) : '']);
  const csv='\uFEFF'+[cabecalho,...linhas].map(l=>l.map(csvCelula).join(';')).join('\r\n')+'\r\n';
  res.set('Content-Type','text/csv; charset=utf-8');
  res.set('Content-Disposition','attachment; filename="visitas_vedacaohub.csv"');
  res.send(csv);
}));

app.get('/auditoria',somenteDono,asyncRoute(async(req,res)=>res.json(await prisma.auditoria.findMany({take:100,orderBy:{criadoEm:'desc'},include:{usuario:{select:projection}}}))));
app.get('/geo/geocodificar',asyncRoute(async(req,res)=>{
  const endereco=String(req.query.endereco??'').trim();
  if(endereco.length<8||endereco.length>500) fail(400,'Informe um endereço válido.');
  const resultado=await geocodificar(endereco);
  if(!resultado) fail(422,'Endereço não encontrado. Tente incluir cidade e estado ou selecione o ponto no mapa.');
  res.json(resultado);
}));
app.use((err,req,res,next)=>{
  if(err?.type==='entity.parse.failed') return res.status(400).json({erro:'JSON inválido.'});
  if(err instanceof ZodError) return res.status(400).json({erro:'Dados inválidos.',detalhes:err.issues.map(i=>({campo:i.path.join('.'),mensagem:i.message}))});
  if(err?.type==='entity.too.large') return res.status(413).json({erro:'Arquivo muito grande. O limite é 3 MB por imagem.'});
  if(err?.httpStatus) return res.status(err.httpStatus).json({erro:err.message,...(err.publicCode?{codigo:err.publicCode}:{})});
  if(isPrismaConflict(err)) return res.status(409).json({erro:'Conflito de dados. Recarregue e tente novamente.'});
  if(err?.code==='P2002') return res.status(409).json({erro:'Registro duplicado.'});
  console.error('[API]',err);
  res.status(500).json({erro:'Erro interno do servidor.'});
});
const port=Number(process.env.PORT||3001);
app.listen(port,'0.0.0.0',()=>console.log(`API em http://localhost:${port}`));
