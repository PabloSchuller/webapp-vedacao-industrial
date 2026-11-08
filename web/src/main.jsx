import {CamposFisicos, HistoricoFisico, novoRegistro} from './RegistroFisico';
import React, {useEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {LayoutDashboard,Warehouse,MapPinned,ClipboardList,Plus,LogOut,ShieldCheck,Search,CheckCircle2,AlertTriangle,Clock3,ArrowLeft,MapPin,CalendarDays,HardHat,ArrowRight,LoaderCircle,RefreshCw,BarChart3,UserCircle2,Navigation,ShieldAlert,Menu,X,Users,FileDown,Pencil,History,UserPlus,Trash2,RotateCcw,LockKeyhole,EyeOff,Camera,ImagePlus,Printer,Tag,Filter,Download,FileImage} from 'lucide-react';
import './styles.css';
import LocationPicker from './LocationPicker';
import MapsPanel from './MapsPanel';
import {locationURL} from './location';
import {request,fetchApi,SESSION_EXPIRED} from './apiClient';
import {parseRoute,routeHash} from './navigation';
import {expiresAt,canManagePhoto} from './session';

const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const fmtDate=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)):'';
const pct=n=>`${Number(n||0).toFixed(Number(n)%1?1:0)}%`;
const errorText=e=>typeof e==='string'?e:e?.message||'Não foi possível concluir a operação.';
async function downloadAutenticado(caminho,token,nome){
  const r=await fetchApi(caminho,{token});
  if(!r.ok)throw new Error('Não foi possível gerar o arquivo.');
  const blob=await r.blob();const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function abrirRelatorio(id,token){
  const pagina=window.open('','_blank');
  if(!pagina)throw new Error('Permita janelas pop-up para gerar o relatório.');
  try{
    const r=await fetchApi(`/relatorios/galpoes/${id}/imprimir`,{token});
    if(!r.ok)throw new Error('Não foi possível gerar o relatório.');
    pagina.document.open();pagina.document.write(await r.text());pagina.document.close();
  }catch(e){pagina.close();throw e;}
}
function FotoMiniatura({token,foto}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let vivo=true,arquivo='';
    fetchApi(`/fotos/${foto.id}/arquivo`,{token})
      .then(r=>{if(!r.ok)throw new Error('Imagem não disponível');return r.blob()})
      .then(blob=>{arquivo=URL.createObjectURL(blob);if(vivo)setUrl(arquivo);else URL.revokeObjectURL(arquivo)})
      .catch(()=>{});
    return ()=>{vivo=false;if(arquivo)URL.revokeObjectURL(arquivo)};
  },[token,foto.id]);
  return url?<a href={url} target="_blank" rel="noreferrer"><img className="evidencia-mini" src={url} alt={foto.nome}/></a>:<div className="evidencia-mini placeholder"><FileImage size={20}/></div>;
}
function FotosVisita({token,visita,usuario}){
  const [aberto,setAberto]=useState(false),[fotos,setFotos]=useState(null),[erro,setErro]=useState(''),[busy,setBusy]=useState(false);
  async function recarregar(){try{setFotos(await request(`/visitas/${visita.id}/fotos`,{token}));setErro('')}catch(e){setErro(errorText(e))}}
  async function abrir(){if(!aberto&&!fotos)await recarregar();setAberto(v=>!v)}
  async function adicionar(e){
    const arquivos=[...e.target.files];e.target.value='';if(!arquivos.length)return;
    setBusy(true);setErro('');
    try{
      for(const f of arquivos){
        if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>3*1024*1024||f.size<20)throw new Error(`Arquivo ${f.name}: envie imagem JPEG/PNG/WebP de até 3 MB.`);
        const dadosBase64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Erro ao ler arquivo'));r.onload=()=>resolve(String(r.result).split(',')[1]);r.readAsDataURL(f)});
        await request(`/visitas/${visita.id}/fotos`,{token,method:'POST',body:{nome:f.name.slice(0,120),mime:f.type,dadosBase64}});
      }
      await recarregar();
    }catch(ex){setErro(errorText(ex))}finally{setBusy(false)}
  }
  async function remover(foto){
    if(!window.confirm(`Remover a foto ${foto.nome} da visualização? O evento ficará auditado.`))return;
    setBusy(true);try{await request(`/fotos/${foto.id}`,{token,method:'DELETE'});await recarregar()}catch(e){setErro(errorText(e))}finally{setBusy(false)}
  }
  return <div className="evidencias"><button type="button" className="btn outline" onClick={abrir}><Camera size={15}/>{aberto?'Ocultar fotos':'Fotos e evidências'}</button>{aberto&&<div className="evidencias-body"><ErrorBox message={erro}/><div className="evidencias-grid">{(fotos||[]).map(f=><div className="evidencia" key={f.id}><FotoMiniatura token={token} foto={f}/><small title={f.nome}>{f.nome}</small>{canManagePhoto(usuario,f.autorId)&&<button type="button" className="mini-link" onClick={()=>remover(f)} disabled={busy}>Remover</button>}</div>)}</div>{fotos?.length===0&&<p className="micro-note">Nenhuma foto anexada.</p>}{canManagePhoto(usuario,visita.autorId)&&<label className="btn outline upload-button"><ImagePlus size={15}/>{busy?'Enviando…':'Anexar fotos'}<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={adicionar} disabled={busy}/></label>}<p className="micro-note">Até 12 fotos por visita, 3 MB cada. As imagens ficam no banco de dados e não são usadas automaticamente para treinar a IA.</p></div>}</div>
}
function RotularVisita({token,visita}){
  const [aberto,setAberto]=useState(false),[classe,setClasse]=useState(''),[justificativa,setJustificativa]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  async function abrir(){if(!aberto){try{const r=await request(`/visitas/${visita.id}/rotulo`,{token});if(r){setClasse(r.classe);setJustificativa(r.justificativa||'')}}catch(e){setMsg(errorText(e))}}setAberto(a=>!a)}
  async function salvar(){setBusy(true);setMsg('');try{await request(`/visitas/${visita.id}/rotulo`,{token,method:'PUT',body:{classe,justificativa}});setMsg('Rótulo humano salvo. Não altera o modelo automaticamente.')}catch(e){setMsg(errorText(e))}finally{setBusy(false)}}
  return <div className="rotulo-box"><button type="button" className="btn outline" onClick={abrir}><Tag size={15}/>{aberto?'Ocultar classificação humana':'Classificar relato para a IA'}</button>{aberto&&<div className="rotulo-fields"><label>Classificação correta segundo o responsável<select value={classe} onChange={e=>setClasse(e.target.value)}><option value="">Selecione…</option><option value="TRABALHO_EXECUTADO">Houve trabalho executado</option><option value="SEM_EXECUCAO">Nenhum trabalho executado</option><option value="INDEFINIDO">Relato não permite concluir</option></select></label><label>Justificativa (opcional)<textarea rows="2" value={justificativa} onChange={e=>setJustificativa(e.target.value)} maxLength={1000} placeholder="Por que essa é a classe correta?"/></label><button type="button" className="btn primary" onClick={salvar} disabled={busy||!classe}>Salvar rótulo</button>{msg&&<p className="field-note">{msg}</p>}<p className="micro-note">Avalie o texto por seu conteúdo, sem usar a previsão da IA como resposta. O rótulo poderá integrar um conjunto de treino futuro.</p></div>}</div>;
}
function Logo(){return <div className="logo"><div className="logo-mark"><HardHat size={23}/></div><div><b>vedação<span>hub</span></b><small>CONTROLE DE OBRAS</small></div></div>}
function Pill({status}){const map={PLANEJADA:['Planejada','neutral'],EM_ANDAMENTO:['Em andamento','blue'],CONCLUIDA:['Concluída','green'],PAUSADA:['Pausada','amber'],APROVADA:['Aprovada','green'],PENDENTE:['Em revisão','amber'],REJEITADA:['Rejeitada','red']};let [s,c]=map[status]||[status,'neutral'];return <span className={`pill ${c}`}><i></i>{s}</span>}
function ErrorBox({message}){return message?<div className="feedback danger"><AlertTriangle size={17}/><span>{message}</span></div>:null}
function Loading(){return <div className="loading"><LoaderCircle className="spin" size={26}/> Carregando dados…</div>}
function SectionTitle({eyebrow,title,subtitle,action}){return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action&&<div className="title-action">{action}</div>}</div>}
function Login({onLogin}){
  const [email,setEmail]=useState('');
  const [senha,setSenha]=useState('');
  const [senhaNova,setSenhaNova]=useState('');
  const [confirmacao,setConfirmacao]=useState('');
  const [alterando,setAlterando]=useState(false);
  const [busy,setBusy]=useState(false);
  const [erro,setErro]=useState('');
  const [sucesso,setSucesso]=useState('');

  function alternarModo(){
    setAlterando(v=>!v);
    setSenha('');setSenhaNova('');setConfirmacao('');
    setErro('');setSucesso('');
  }
  async function submit(e){
    e.preventDefault();setErro('');setSucesso('');
    if(alterando){
      if(senhaNova.length<10){setErro('A nova senha precisa ter pelo menos 10 caracteres.');return;}
      if(senhaNova!==confirmacao){setErro('As novas senhas não coincidem.');return;}
      if(senhaNova===senha){setErro('A nova senha deve ser diferente da atual.');return;}
    }
    setBusy(true);
    try{
      // Login temporário para confirmar a senha atual: o token não é salvo em sessão.
      const credenciais=await request('/auth/login',{method:'POST',body:{email,senha}});
      if(alterando){
        await request('/auth/senha',{token:credenciais.token,method:'PATCH',body:{senhaAtual:senha,senhaNova}});
        setSenha('');setSenhaNova('');setConfirmacao('');
        setAlterando(false);
        setSucesso('Senha atualizada com sucesso. Entre com sua nova senha.');
      }else{
        onLogin(credenciais);
      }
    }catch(e){setErro(errorText(e));}
    finally{setBusy(false);}
  }
  return <div className="auth-page">
    <div className="auth-art"><div className="art-gradient"/><div className="art-inner">
      <Logo/><div className="art-copy"><div className="art-label">OBRAS SOB CONTROLE</div>
      <h2>Cada galpão.<br/>Cada visita.<br/><em>Todo o histórico.</em></h2>
      <p>Uma plataforma para organizar obras de vedação industrial, acompanhar avanços e identificar registros que merecem atenção.</p>
      <div className="art-features"><span><CheckCircle2 size={16}/> Histórico rastreável</span><span><CheckCircle2 size={16}/> Geolocalização</span><span><CheckCircle2 size={16}/> Validação inteligente</span></div></div>
      <div className="art-footer">CONTROLE DE OBRAS INDUSTRIAIS</div>
    </div></div>
    <div className="auth-form-zone"><div className="auth-panel">
      <div className="eyebrow">{alterando?'SEGURANÇA DA CONTA':'BEM-VINDO DE VOLTA'}</div>
      <h1>{alterando?'Alterar minha senha':'Acesse sua conta'}</h1>
      <p>{alterando?'Confirme suas credenciais atuais e defina uma nova senha.':'Entre com suas credenciais para continuar gerenciando suas obras.'}</p>
      <form onSubmit={submit} className="form">
        <label>E-mail<input required type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>{alterando?'Senha atual':'Senha'}<input required type="password" autoComplete="current-password" placeholder={alterando?'Digite sua senha atual':'Sua senha'} value={senha} onChange={e=>setSenha(e.target.value)}/></label>
        {alterando&&<>
          <label>Nova senha (mínimo 10 caracteres)<input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={senhaNova} onChange={e=>setSenhaNova(e.target.value)}/></label>
          <label>Confirmar nova senha<input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmacao} onChange={e=>setConfirmacao(e.target.value)}/></label>
        </>}
        <ErrorBox message={erro}/>
        {sucesso&&<div className="feedback success" role="status"><CheckCircle2 size={17}/><span>{sucesso}</span></div>}
        <button disabled={busy} className="btn primary big" type="submit">
          {alterando?<><LockKeyhole size={18}/>{busy?'Atualizando…':'Confirmar alteração de senha'}</>:<>{busy?'Entrando…':'Entrar no sistema'} <ArrowRight size={18}/></>}
        </button>
      </form>
      <button type="button" className="auth-mode-button" onClick={alternarModo} disabled={busy}>
        {alterando?<><ArrowLeft size={16}/> Voltar ao login</>:<><LockKeyhole size={16}/> Alterar minha senha</>}
      </button>
      {alterando&&<p className="auth-security-note">Por segurança, você precisa saber sua senha atual. Se a esqueceu, solicite ao administrador um procedimento de recuperação seguro.</p>}
    </div></div>
  </div>;
}
function Dashboard({token,onGo}){
  const[data,setData]=useState(null),[galpoes,setGalpoes]=useState([]),[error,setError]=useState('');
  useEffect(()=>{Promise.all([request('/indicadores',{token}),request('/galpoes',{token})]).then(([d,g])=>{setData(d);setGalpoes(g)}).catch(e=>setError(errorText(e)))},[token]);
  if(error)return <ErrorBox message={error}/>;if(!data)return <Loading/>;
  return <><SectionTitle eyebrow="VISÃO GERAL" title="Painel de obras" subtitle="Acompanhe o andamento e mantenha os dados de cada galpão organizados." action={<button className="btn primary" onClick={()=>onGo('novo')}><Plus size={17}/> Novo galpão</button>}/><div className="stats"><div className="stat-card"><div className="stat-icon blue-icon"><Warehouse size={21}/></div><span>Galpões cadastrados</span><strong>{data.total}</strong><small>Total sob acompanhamento</small></div><div className="stat-card"><div className="stat-icon green-icon"><CheckCircle2 size={21}/></div><span>Obras concluídas</span><strong>{data.concluidos}</strong><small>Com conclusão registrada</small></div><div className="stat-card"><div className="stat-icon amber-icon"><ShieldAlert size={21}/></div><span>Aguardando revisão</span><strong>{data.pendentes}</strong><small>Visitas para validar</small></div><div className="stat-card"><div className="stat-icon purple-icon"><BarChart3 size={21}/></div><span>Visitas registradas</span><strong>{galpoes.reduce((total,g)=>total+g._count.visitas,0)}</strong><small>Nos galpões cadastrados</small></div></div><div className="dashboard-grid"><section className="surface"><div className="surface-header"><div><h2>Obras em acompanhamento</h2><p>Situação dos galpões cadastrados</p></div><button className="text-button" onClick={()=>onGo('galpoes')}>Ver todos <ArrowRight size={15}/></button></div><div className="items">{galpoes.slice(0,5).map(g=><button onClick={()=>onGo('detalhe',g.id)} className="work-row" key={g.id}><div className="work-symbol"><Warehouse size={18}/></div><div className="work-info"><div className="work-title">{g.nome}</div><span>{g.cliente}</span></div><Pill status={g.status}/><ArrowRight size={16} className="muted"/></button>)}{!galpoes.length&&<div className="empty">Nenhum galpão cadastrado.</div>}</div></section><section className="surface"><div className="surface-header"><div><h2>Últimas atividades</h2><p>Histórico recente da equipe</p></div><ClipboardList size={19} className="muted"/></div><div className="timeline">{data.ultimas.map(v=><div className="activity" key={v.id}><div className="activity-dot"/><div><strong>{v.galpao.nome}</strong><p>{v.descricao.slice(0,108)}{v.descricao.length>108?'…':''}</p><small>{v.autor.nome} · {fmtDate(v.dataVisita)} · <Pill status={v.revisao}/></small></div></div>)}{!data.ultimas.length&&<div className="empty">As visitas registradas aparecerão aqui.</div>}</div></section></div></>
}
function Galpoes({token,onGo}){
  const[data,setData]=useState(null),[error,setError]=useState(''),[query,setQuery]=useState('');
  useEffect(()=>{request('/galpoes',{token}).then(setData).catch(e=>setError(errorText(e)))},[token]);
  const filtered=(data||[]).filter(g=>(g.nome+' '+g.cliente+' '+g.endereco).toLowerCase().includes(query.toLowerCase()));
  return <><SectionTitle eyebrow="PORTFÓLIO" title="Meus galpões" subtitle="Consulte o endereço, o histórico e a evolução de cada obra." action={<button className="btn primary" onClick={()=>onGo('novo')}><Plus size={17}/> Cadastrar galpão</button>}/><div className="toolbar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, cliente ou cidade"/></div><span>{filtered.length} resultado(s)</span></div><ErrorBox message={error}/>{!data?<Loading/>:<><div className="galpoes-grid">{filtered.map(g=><button key={g.id} className="galpao-card" onClick={()=>onGo('detalhe',g.id)}><div className="galpao-card-top"><div className="work-symbol large"><Warehouse size={24}/></div><Pill status={g.status}/></div><h3>{g.nome}</h3><p className="client">{g.cliente}</p><p className="address"><MapPin size={15}/>{g.endereco}</p><div className="card-footer"><span><ClipboardList size={15}/>{g._count.visitas} visitas</span><span>Abrir <ArrowRight size={15}/></span></div></button>)}</div>{filtered.length===0&&<div className="empty large-empty">Nenhum galpão encontrado.</div>}<section className="surface maps-section"><div className="surface-header"><div><h2>Localização dos canteiros</h2><p>Visualize os pontos cadastrados ou abra no OpenStreetMap</p></div><MapPinned size={20} className="muted"/></div><MapsPanel galpoes={filtered}/></section></>}</>
}
function NovoGalpao({token,onGo}){
  const[form,setForm]=useState({nome:'',cliente:'',endereco:'',dataInicio:today(),status:'PLANEJADA',descricao:'',latitude:'',longitude:''});const[erro,setErro]=useState(''),[busy,setBusy]=useState(false);
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function submit(e){e.preventDefault();setBusy(true);setErro('');try{const d={...form,latitude:form.latitude===''?null:Number(form.latitude),longitude:form.longitude===''?null:Number(form.longitude)};const g=await request('/galpoes',{token,method:'POST',body:d});onGo('detalhe',g.id);}catch(e){setErro(errorText(e));}finally{setBusy(false)}}
  return <><SectionTitle eyebrow="CADASTRO" title="Novo galpão" subtitle="Registre os dados principais do canteiro de vedação industrial." action={<button className="btn outline" onClick={()=>onGo('galpoes')}><ArrowLeft size={16}/> Voltar</button>}/><div className="surface form-surface"><form className="form" onSubmit={submit}><div className="form-group-title">Informações da obra</div><div className="form-two"><label>Nome do galpão *<input value={form.nome} onChange={e=>set('nome',e.target.value)} required minLength={3} placeholder="Ex.: Galpão setor norte"/></label><label>Cliente *<input value={form.cliente} onChange={e=>set('cliente',e.target.value)} required placeholder="Nome da empresa"/></label></div><label>Endereço completo *<input value={form.endereco} onChange={e=>set('endereco',e.target.value)} minLength={8} required placeholder="Rua, número, bairro, cidade, estado"/></label><div className="form-two"><label>Data de início *<input type="date" value={form.dataInicio} onChange={e=>set('dataInicio',e.target.value)} required/></label><label>Situação<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="PLANEJADA">Planejada</option><option value="EM_ANDAMENTO">Em andamento</option><option value="PAUSADA">Pausada</option></select></label></div><label>Observações<textarea rows="3" value={form.descricao} onChange={e=>set('descricao',e.target.value)} placeholder="Escopo, características, cuidados..."/></label><div className="form-group-title with-icon"><MapPin size={18}/> Marque a localização da obra no OpenStreetMap</div><LocationPicker token={token} endereco={form.endereco} latitude={form.latitude} longitude={form.longitude} onSelect={({latitude,longitude})=>setForm(f=>({...f,latitude,longitude}))} onAddressSuggestion={endereco=>set('endereco',endereco)}/><p className="field-note">Você não precisa digitar latitude e longitude: basta buscar o endereço e posicionar o marcador.</p><ErrorBox message={erro}/><div className="form-actions"><button type="button" className="btn outline" onClick={()=>onGo('galpoes')}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>{busy?'Salvando…':'Salvar galpão'} <ArrowRight size={17}/></button></div></form></div></>
}

function EditarGalpao({token,id,onGo}){
  const [form,setForm]=useState(null),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{request('/galpoes/'+id,{token}).then(g=>setForm({nome:g.nome,cliente:g.cliente,endereco:g.endereco,dataInicio:g.dataInicio.slice(0,10),status:g.status,descricao:g.descricao||'',latitude:g.latitude==null?'':String(g.latitude),longitude:g.longitude==null?'':String(g.longitude)})).catch(e=>setErro(errorText(e)))},[token,id]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  async function submit(e){e.preventDefault();setBusy(true);setErro('');setSucesso('');try{const d={...form,latitude:form.latitude===''?null:Number(form.latitude),longitude:form.longitude===''?null:Number(form.longitude)};await request('/galpoes/'+id,{token,method:'PATCH',body:d});onGo('detalhe',id)}catch(e){setErro(errorText(e))}finally{setBusy(false)}}
  if(erro&&!form)return <ErrorBox message={erro}/>;
  if(!form)return <Loading/>;
  return <><SectionTitle eyebrow="ATUALIZAÇÃO CADASTRAL" title="Editar galpão" subtitle="Alterações registradas na auditoria." action={<button className="btn outline" onClick={()=>onGo('detalhe',id)}><ArrowLeft size={16}/> Voltar</button>}/>
    <div className="surface form-surface"><form onSubmit={submit} className="form">
      <div className="form-two"><label>Nome do galpão *<input required minLength={3} value={form.nome} onChange={e=>set('nome',e.target.value)}/></label><label>Cliente *<input required minLength={2} value={form.cliente} onChange={e=>set('cliente',e.target.value)}/></label></div>
      <label>Endereço *<input required minLength={8} value={form.endereco} onChange={e=>set('endereco',e.target.value)}/></label>
      <div className="form-two"><label>Data inicial *<input type="date" value={form.dataInicio} onChange={e=>set('dataInicio',e.target.value)}/></label><label>Situação<select value={form.status} onChange={e=>set('status',e.target.value)}>
      <option value="PLANEJADA">Planejada</option><option value="EM_ANDAMENTO">Em andamento</option><option value="PAUSADA">Pausada</option><option value="CONCLUIDA">Concluída</option></select></label></div>
      <label>Descrição / escopo<textarea rows="3" value={form.descricao} onChange={e=>set('descricao',e.target.value)}/></label>
      <div className="form-group-title with-icon"><MapPin size={18}/> Localização do galpão no mapa</div>
      <LocationPicker token={token} endereco={form.endereco} latitude={form.latitude} longitude={form.longitude} onSelect={({latitude,longitude})=>setForm(f=>({...f,latitude,longitude}))} onAddressSuggestion={endereco=>set('endereco',endereco)}/>
      {sucesso&&<p className="field-note">{sucesso}</p>}<ErrorBox message={erro}/>
      <div className="form-actions"><button type="button" className="btn outline" onClick={()=>onGo('detalhe',id)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>{busy?'Salvando…':'Salvar alterações'}</button></div>
    </form></div></>;
}

function Funcionarios({token}){
  const [usuarios,setUsuarios]=useState(null),[erro,setErro]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const [form,setForm]=useState({nome:'',email:'',senha:'',papel:'FUNCIONARIO'});
  useEffect(()=>{request('/usuarios',{token}).then(setUsuarios).catch(e=>setErro(errorText(e)))},[token,reload]);
  async function criar(e){e.preventDefault();setBusy(true);setErro('');try{await request('/usuarios',{token,method:'POST',body:form});setForm({nome:'',email:'',senha:'',papel:'FUNCIONARIO'});setReload(i=>i+1);}catch(e){setErro(errorText(e))}finally{setBusy(false)}}
  async function mudar(usuario){if(!window.confirm(`${usuario.ativo?'Desativar':'Ativar'} o acesso de ${usuario.nome}?`))return;setBusy(true);setErro('');try{await request(`/usuarios/${usuario.id}/ativo`,{token,method:'PATCH',body:{ativo:!usuario.ativo}});setReload(i=>i+1)}catch(e){setErro(errorText(e))}finally{setBusy(false)}}
  async function exportar(){setErro('');try{const r=await fetchApi('/relatorios/visitas.csv',{token});if(!r.ok)throw new Error('Não foi possível exportar os registros.');const blob=await r.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='visitas_vedacaohub.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);}catch(e){setErro(errorText(e))}}
  async function exportarRotulos(){try{await downloadAutenticado('/relatorios/relatos_rotulados.csv',token,'relatos_rotulados_vedacaohub.csv')}catch(e){setErro(errorText(e))}}
  return <><SectionTitle eyebrow="ADMINISTRAÇÃO" title="Funcionários e relatórios" subtitle="Crie contas individuais e exporte os registros para análise da empresa." action={<button className="btn outline" onClick={exportar}><FileDown size={16}/> Exportar visitas (CSV)</button>}/>
    <ErrorBox message={erro}/><div className="dashboard-grid"><section className="surface"><div className="surface-header"><div><h2>Contas cadastradas</h2><p>Desativar impede novos acessos e invalida tokens nas próximas requisições</p></div></div>
    {!usuarios?<Loading/>:<div className="items">{usuarios.map(u=><div key={u.id} className="work-row" style={{cursor:'default'}}><div className="work-symbol"><UserCircle2 size={18}/></div><div className="work-info"><div className="work-title">{u.nome}</div><span>{u.email} · {u.papel==='DONO'?'Responsável':'Funcionário'} · {u.ativo?'Ativo':'Inativo'}</span></div>{u.papel==='FUNCIONARIO'&&<button className="btn outline" disabled={busy} onClick={()=>mudar(u)}>{u.ativo?'Desativar':'Ativar'}</button>}</div>)}</div>}</section>
    <section className="surface form-surface"><div className="form-group-title"><UserPlus size={18}/> Novo funcionário</div><form className="form" onSubmit={criar}><label>Nome<input required minLength={2} maxLength={120} value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/></label><label>E-mail<input required type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></label><label>Senha inicial (mínimo 10 caracteres)<input required type="password" minLength={10} value={form.senha} onChange={e=>setForm(f=>({...f,senha:e.target.value}))}/></label><button type="submit" className="btn primary" disabled={busy}>{busy?'Criando…':'Criar funcionário'}</button></form><p className="micro-note">Use uma senha exclusiva e compartilhe somente com o funcionário correspondente. Não cadastre uma segunda conta DONO neste formulário.</p></section></div>
    <button className="btn outline" onClick={exportarRotulos}><Tag size={16}/> Exportar relatos rotulados para treinamento (CSV)</button>
    <p className="micro-note">A exportação é destinada ao uso autorizado. O arquivo inclui informações de clientes e visitas: armazene-o de modo seguro.</p></>;
}

function AuditoriaGalpao({token,id}){
  const [dados,setDados]=useState(null),[erro,setErro]=useState('');
  useEffect(()=>{request('/galpoes/'+id+'/auditoria',{token}).then(setDados).catch(e=>setErro(errorText(e)))},[token,id]);
  if(erro)return <ErrorBox message={erro}/>;if(!dados)return <Loading/>;
  return <div className="visits-list">{dados.map(a=><div key={a.id} className="visit-card"><div className="visit-top"><div><span className="visit-date">{new Date(a.criadoEm).toLocaleString('pt-BR')}</span><h3>{a.usuario?.nome||'Usuário'} · {a.acao} ({a.entidade})</h3></div></div>{a.detalhes?.alteracoes?<div>{Object.entries(a.detalhes.alteracoes).map(([campo,valor])=><p key={campo} className="visit-justification"><b>{campo}:</b> {String(valor.antes??'—')} → {String(valor.depois??'—')}</p>)}</div>:<p className="micro-note">Operação registrada: {a.acao}</p>}</div>)}{dados.length===0&&<div className="empty">Ainda não há alterações registradas.</div>}</div>;
}

function VisitaForm({token,galpao,onSaved}){
  const[form,setForm]=useState({galpaoId:galpao.id,dataVisita:today(),descricao:'',registroFisico:novoRegistro(),gpsLatitude:null,gpsLongitude:null});
  const[pre,setPre]=useState(null),[erro,setErro]=useState(''),[busy,setBusy]=useState(false),[locationInfo,setLocationInfo]=useState('');
  const set=(k,v)=>{setPre(null);setForm(f=>({...f,[k]:v}));};
  function geo(){if(!navigator.geolocation)return setLocationInfo('O navegador não oferece geolocalização.');setLocationInfo('Obtendo GPS…');navigator.geolocation.getCurrentPosition(p=>{set('gpsLatitude',p.coords.latitude);set('gpsLongitude',p.coords.longitude);setLocationInfo('GPS obtido: confira a distância e a precisão antes de enviar.');},()=>setLocationInfo('Localização negada ou indisponível. É possível salvar sem GPS.'),{enableHighAccuracy:true,timeout:10000});}
  const registro = form.registroFisico;
  const semExecucao = registro.situacao === 'SEM_EXECUCAO';
  const descricao = form.descricao;
  async function call(path) {
    setBusy(true);
    setErro('');
    try {
      const registroFisico = {...registro,
        servicos: registro.situacao === 'TRABALHO_EXECUTADO' ? registro.servicos : []
      };
      const d = await request(path, {token, method:'POST', body:{...form, descricao, registroFisico}});
      if (path.endsWith('/validar')) setPre(d);
      else onSaved();
    } catch(e) {
      const detalhes = e.detalhes?.map(issue => issue.mensagem).join(' ');
      setErro(detalhes || errorText(e));
    } finally { setBusy(false); }
  }
  return <div className="form visita-form"><div className="form-two"><label>Data da visita<input type="date" value={form.dataVisita} onChange={e=>set('dataVisita',e.target.value)} required/></label></div>
    <CamposFisicos registro={registro} onChange={r => set('registroFisico',r)}/>
    <label>{semExecucao ? 'Motivo da ausência de execução' : 'Relato da visita'} *
      <textarea rows={3} minLength={10} maxLength={3000} value={descricao}
        placeholder="Descreva as atividades, quantidades, locais, materiais e impedimentos."
        onChange={e => set('descricao',e.target.value)}/>
    </label><button type="button" className="btn outline align-left" onClick={geo}><Navigation size={15}/> Adicionar localização GPS</button>{locationInfo&&<p className="field-note">{locationInfo}</p>}<ErrorBox message={erro}/>{pre&&<div className={`validation-box ${pre.status==='BLOQUEAR'?'red':pre.status==='REVISAR'?'yellow':'ok'}`}><strong>{pre.status==='APROVAR'?'Nenhuma inconsistência sinalizada':pre.status==='REVISAR'?'Revisão do responsável necessária':'Registro bloqueado'}</strong><span>Classificação IA: {pre.iaClasse||'Indisponível'} · Confiança estimada: {pre.iaConfianca==null?'—':pct(pre.iaConfianca*100)}</span>{[...pre.bloqueios,...pre.avisos].map((av,i)=><div key={i}>• {av}</div>)}</div>}<div className="form-actions"><button type="button" disabled={busy||descricao.trim().length<10} className="btn outline" onClick={()=>call('/visitas/validar')}><ShieldCheck size={16}/> Validar com IA</button><button type="button" disabled={busy||descricao.trim().length<10||pre?.status==='BLOQUEAR'} className="btn primary" onClick={()=>call('/visitas')}><Plus size={17}/> Salvar visita</button></div><p className="micro-note">A validação será executada novamente no servidor ao salvar. Visitas sinalizadas ficam pendentes até a decisão do responsável.</p></div>
}
function Detalhe({token,id,onGo,papel,usuario}){
  const[data,setData]=useState(null),[error,setError]=useState(''),[mostrarForm,setMostrarForm]=useState(false),[mostrarAuditoria,setMostrarAuditoria]=useState(false),[reload,setReload]=useState(0),[excluir,setExcluir]=useState(false),[nomeConfirmacao,setNomeConfirmacao]=useState(''),[motivo,setMotivo]=useState(''),[busyExcluir,setBusyExcluir]=useState(false),[erroExcluir,setErroExcluir]=useState(''),[filtroInicio,setFiltroInicio]=useState(''),[filtroFim,setFiltroFim]=useState(''),[filtroStatus,setFiltroStatus]=useState(''),[buscaRelato,setBuscaRelato]=useState('');
  useEffect(()=>{request('/galpoes/'+id,{token}).then(setData).catch(e=>setError(errorText(e)))},[token,id,reload]);
  async function excluirGalpao(){
    if(nomeConfirmacao!==data?.nome || motivo.trim().length<5)return;
    setBusyExcluir(true);setErroExcluir('');
    try{await request(`/galpoes/${id}`,{token,method:'DELETE',body:{motivo:motivo.trim()}});onGo('galpoes');}
    catch(e){setErroExcluir(errorText(e));}finally{setBusyExcluir(false)}
  }
  if(error)return <><button className="btn outline" onClick={()=>onGo('galpoes')}><ArrowLeft size={16}/> Voltar</button><ErrorBox message={error}/></>;
  if(!data)return <Loading/>;
  const visitasFiltradas=data.visitas.filter(v=>(!filtroInicio||v.dataVisita.slice(0,10)>=filtroInicio)&&(!filtroFim||v.dataVisita.slice(0,10)<=filtroFim)&&(!filtroStatus||v.revisao===filtroStatus)&&(!buscaRelato||v.descricao.toLowerCase().includes(buscaRelato.toLowerCase())));
  return <><SectionTitle eyebrow="DETALHES DA OBRA" title={data.nome} subtitle={`${data.cliente} · Cadastrado em ${fmtDate(data.criadoEm)}`} action={<div className="form-actions" style={{marginTop:0}}>{papel==='DONO'&&<><button className="btn outline" onClick={async()=>{try{await abrirRelatorio(id,token)}catch(e){window.alert(errorText(e))}}}><Printer size={16}/> Relatório / PDF</button><button className="btn primary" onClick={()=>onGo('editar',id)}><Pencil size={16}/> Editar galpão</button><button className="btn danger-outline" onClick={()=>setExcluir(v=>!v)}><Trash2 size={16}/> Excluir galpão</button></>}<button className="btn outline" onClick={()=>onGo('galpoes')}><ArrowLeft size={16}/> Galpões</button></div>}/>{excluir&&papel==='DONO'&&<section className="surface deletion-panel"><h2><Trash2 size={20}/> Excluir este galpão?</h2><p>Ele sairá da lista de obras e deixará de receber visitas. <strong>Nenhum histórico será apagado</strong>: o proprietário poderá restaurá-lo pela Lixeira.</p><label>Motivo da exclusão *<textarea rows="2" value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={500} placeholder="Ex.: Cadastro duplicado; obra cancelada…"/></label><label>Digite o nome exato do galpão para confirmar *<input value={nomeConfirmacao} onChange={e=>setNomeConfirmacao(e.target.value)} placeholder={data.nome}/></label><ErrorBox message={erroExcluir}/><div className="form-actions"><button type="button" className="btn outline" onClick={()=>setExcluir(false)}>Cancelar</button><button type="button" className="btn danger" disabled={busyExcluir||nomeConfirmacao!==data.nome||motivo.trim().length<5} onClick={excluirGalpao}><Trash2 size={16}/> {busyExcluir?'Excluindo…':'Confirmar exclusão'}</button></div></section>}
  <div className="detail-top"><section className="surface detail-summary"><div className="subtle-title">RESUMO DO GALPÃO</div><div className="summary-head"><Pill status={data.status}/></div><div className="detail-attributes"><div><CalendarDays size={17}/><span>Início da obra</span><strong>{fmtDate(data.dataInicio)}</strong></div><div><MapPin size={17}/><span>Endereço</span><strong>{data.endereco}</strong></div><div><ClipboardList size={17}/><span>Visitas registradas</span><strong>{data.visitas.length}</strong></div></div>{data.descricao&&<p className="description-note">{data.descricao}</p>}</section><section className="surface detail-map"><div className="surface-header"><div><h2>Localização</h2><p>Ponto de referência para chegar à obra</p></div><a href={locationURL(data)} target="_blank" rel="noreferrer" className="text-button">Abrir rota <Navigation size={15}/></a></div><MapsPanel galpoes={[data]} height={260}/></section></div><section className="surface visita-section"><div className="surface-header"><div><h2>Histórico de visitas</h2><p>Registros preservados por data, técnico e situação de revisão</p></div><button className="btn primary" onClick={()=>setMostrarForm(v=>!v)}>{mostrarForm?<X size={16}/>:<Plus size={17}/>} {mostrarForm?'Fechar':'Registrar visita'}</button></div>{mostrarForm&&<div className="form-expander"><VisitaForm token={token} key={`${id}-${reload}`} galpao={data} onSaved={()=>{setMostrarForm(false);setReload(v=>v+1)}}/></div>}<div className="history-filters"><label><Filter size={14}/> Início<input type="date" value={filtroInicio} onChange={e=>setFiltroInicio(e.target.value)}/></label><label>Fim<input type="date" value={filtroFim} onChange={e=>setFiltroFim(e.target.value)}/></label><label>Revisão<select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}><option value="">Todas</option><option value="APROVADA">Aprovadas</option><option value="PENDENTE">Pendentes</option><option value="REJEITADA">Rejeitadas</option></select></label><label>Descrição<input placeholder="Pesquisar no relato" value={buscaRelato} onChange={e=>setBuscaRelato(e.target.value)}/></label></div><div className="visits-list">{visitasFiltradas.map(v=><div className="visit-card" key={v.id}><div className="visit-top"><div><span className="visit-date"><CalendarDays size={14}/>{fmtDate(v.dataVisita)}</span><h3>{v.autor.nome}</h3></div><Pill status={v.revisao}/></div>{v.descricao !== v.registroFisico?.motivo && <p>{v.descricao}</p>}<div className="visit-meta"><HistoricoFisico visita={v}/><span>IA: <strong>{v.iaClasse||'Não disponível'}</strong>{v.iaVersao&&<small> · {v.iaVersao}</small>}</span></div>{v.avisos?.length>0&&<div className="visit-alert"><AlertTriangle size={16}/><div>{v.avisos.map((a,i)=><div key={i}>{a}</div>)}</div></div>}{v.proximosPassos&&<p className="visit-justification"><b>Próximos passos:</b> {v.proximosPassos}</p>}{v.justificativa&&<p className="visit-justification"><b>Justificativa:</b> {v.justificativa}</p>}{v.comentarioRevisao&&<p className="visit-justification"><b>Decisão:</b> {v.comentarioRevisao} ({v.revisor?.nome})</p>}<div className="visit-extras"><FotosVisita token={token} visita={v} usuario={usuario}/>{papel==='DONO'&&<RotularVisita token={token} visita={v}/>}</div></div>)}{visitasFiltradas.length===0&&<div className="empty">Nenhuma visita registrada. Use “Registrar visita” para começar.</div>}</div></section>{papel==='DONO'&&<section className="surface visita-section"><div className="surface-header"><div><h2>Trilha de auditoria</h2><p>Registros de criação, alterações e revisões</p></div><button className="btn outline" onClick={()=>setMostrarAuditoria(v=>!v)}><History size={16}/>{mostrarAuditoria?'Ocultar':'Exibir auditoria'}</button></div>{mostrarAuditoria&&<AuditoriaGalpao token={token} id={id}/>}</section>}</>
}
function LixeiraGalpoes({token,onGo}){
  const [lista,setLista]=useState(null),[erro,setErro]=useState(''),[busy,setBusy]=useState('');
  useEffect(()=>{request('/galpoes/excluidos',{token}).then(setLista).catch(e=>setErro(errorText(e)))},[token]);
  async function restaurar(g){
    if(!window.confirm(`Restaurar o galpão "${g.nome}" à lista de obras ativas?`))return;
    setBusy(g.id);setErro('');
    try{await request(`/galpoes/${g.id}/restaurar`,{token,method:'PATCH'});setLista(a=>a.filter(item=>item.id!==g.id));}
    catch(e){setErro(errorText(e))}finally{setBusy('')}
  }
  return <><SectionTitle eyebrow="ADMINISTRAÇÃO" title="Lixeira de galpões" subtitle="Galpões excluídos logicamente. Os dados históricos e a auditoria permanecem guardados." action={<button className="btn outline" onClick={()=>onGo('galpoes')}><ArrowLeft size={16}/> Voltar aos galpões</button>}/><ErrorBox message={erro}/>{lista===null?<Loading/>:lista.length===0?<div className="empty large-empty">Nenhum galpão excluído.</div>:<section className="surface"><div className="items">{lista.map(g=><div key={g.id} className="archived-row"><div><h3>{g.nome}</h3><p>{g.cliente} · {g.endereco}</p><small>Excluído em {fmtDate(g.excluidoEm)} · {g._count?.visitas||0} visita(s) preservadas</small><p><strong>Motivo:</strong> {g.motivoExclusao||'Não informado'}</p></div><button className="btn outline" disabled={busy===g.id} onClick={()=>restaurar(g)}><RotateCcw size={16}/>{busy===g.id?'Restaurando…':'Restaurar'}</button></div>)}</div></section>}</>;
}
function Pendencias({token,onGo}){
  const[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[reload,setReload]=useState(0),[comentarios,setComentarios]=useState({});
  useEffect(()=>{request('/visitas/pendentes',{token}).then(setData).catch(e=>setError(errorText(e)))},[token,reload]);
  async function decidir(v,decisao){const comentario=(comentarios[v.id]||'').trim();if(comentario.length<3){setError('Informe uma justificativa com pelo menos 3 caracteres.');return;}setBusy(v.id);setError('');try{await request(`/visitas/${v.id}/revisar`,{token,method:'PATCH',body:{decisao,comentario}});setReload(s=>s+1);}catch(e){setError(errorText(e));}finally{setBusy('')}}
  return <>
    <SectionTitle eyebrow="QUALIDADE DOS DADOS" title="Visitas pendentes" subtitle="Confira os relatos e as medições das visitas sinalizadas."/>
    <ErrorBox message={error}/>
    {!data ? <Loading/> : data.length===0 ?
      <div className="empty large-empty"><ShieldCheck size={34}/> Nenhuma visita aguardando revisão.</div> :
      <div className="pending-list">{data.map(v=>
        <section className="surface pending-card" key={v.id} aria-labelledby={`revisao-${v.id}`}>
          <header className="review-heading">
            <div>
              <h2 id={`revisao-${v.id}`}>{v.galpao.nome}</h2>
              <span>{fmtDate(v.dataVisita)} · {v.autor.nome}</span>
            </div>
            <Pill status="PENDENTE"/>
          </header>
          <div className="review-report">
            <HistoricoFisico visita={v}/>
            {v.descricao !== v.registroFisico?.motivo && <p>{v.descricao}</p>}
            {v.justificativa && <p><b>Justificativa:</b> {v.justificativa}</p>}
          </div>
          {v.avisos.length>0 && <div className="visit-alert">
            <AlertTriangle size={18} aria-hidden="true"/>
            <ul>{v.avisos.map((aviso,i)=><li key={i}>{aviso}</li>)}</ul>
          </div>}
          <div className="form review-controls">
            <label>Justificativa da revisão
              <textarea rows={3} minLength={3} maxLength={2000} value={comentarios[v.id]||''}
                onChange={e=>setComentarios(c=>({...c,[v.id]:e.target.value}))}/>
            </label>
            <div className="form-actions">
              <button className="btn outline" disabled={busy===v.id} onClick={()=>decidir(v,'REJEITAR')}>Rejeitar</button>
              <button className="btn primary" disabled={busy===v.id} onClick={()=>decidir(v,'APROVAR')}><CheckCircle2 size={16}/> Aprovar visita</button>
            </div>
          </div>
        </section>)}</div>}
  </>
}
export function App(){
  const[sess,setSess]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('vedacao_session')||'null')}catch{return null}});
  const[route,setRoute]=useState(()=>parseRoute(window.location.hash)),[menuOpen,setMenuOpen]=useState(false),[sessionMessage,setSessionMessage]=useState('');
  const {page,id:selected}=route;
  useEffect(()=>{const update=()=>setRoute(parseRoute(window.location.hash));window.addEventListener('hashchange',update);return ()=>window.removeEventListener('hashchange',update)},[]);
  useEffect(()=>{
    if(!sess?.token)return;
    const expire=()=>{sessionStorage.removeItem('vedacao_session');setSess(null);setSessionMessage('Sua sessão expirou ou foi revogada. Entre novamente.');};
    const unauthorized=e=>{if(e.detail?.token===sess.token)expire();};
    window.addEventListener(SESSION_EXPIRED,unauthorized);
    const remaining=expiresAt(sess.token)-Date.now();
    const timer=setTimeout(expire,Math.max(0,Math.min(remaining,2147483647)));
    return ()=>{window.removeEventListener(SESSION_EXPIRED,unauthorized);clearTimeout(timer)};
  },[sess?.token]);
  function login(v){sessionStorage.setItem('vedacao_session',JSON.stringify(v));setSessionMessage('');setSess(v)}
  function logout(){sessionStorage.removeItem('vedacao_session');setSessionMessage('');setSess(null);go('dashboard')}
  function go(p,id){const hash=routeHash(p,id);setRoute(parseRoute(hash));window.location.hash=hash;setMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  if(!sess?.token)return <>{sessionMessage&&<div role="alert" className="feedback danger">{sessionMessage}</div>}<Login onLogin={login}/></>;
  const nav=[['dashboard',LayoutDashboard,'Visão geral'],['galpoes',Warehouse,'Galpões'],...(sess.usuario.papel==='DONO'?[['pendencias',ShieldCheck,'Revisões'],['funcionarios',Users,'Funcionários'],['lixeira',Trash2,'Lixeira']]:[])];
  return <div className="app-shell"><aside className={`sidebar ${menuOpen?'shown':''}`}><div className="sidebar-top"><Logo/><button aria-label="Fechar menu" className="mobile-close" onClick={()=>setMenuOpen(false)}><X size={20}/></button></div><div className="nav-label">MENU PRINCIPAL</div><nav>{nav.map(([key,Icon,label])=><button key={key} className={'nav-item '+(page===key||(key==='galpoes'&&['novo','detalhe','editar'].includes(page))?'active':'')} onClick={()=>go(key)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="sidebar-tip"><ShieldCheck size={19}/><strong>Registros confiáveis</strong><span>Validação por regras e modelo treinado no projeto.</span></div><button className="logout" onClick={logout}><LogOut size={17}/> Sair da conta</button></div></aside>{menuOpen&&<div className="overlay" onClick={()=>setMenuOpen(false)}></div>}<div className="main-zone"><header className="topbar"><div className="topbar-left"><button aria-label="Abrir menu" className="hamburger" onClick={()=>setMenuOpen(true)}><Menu size={22}/></button><span>GESTÃO DE OBRAS INDUSTRIAIS</span></div><div className="user-chip"><div className="user-avatar"><UserCircle2 size={19}/></div><div><strong>{sess.usuario.nome}</strong><small>{sess.usuario.papel==='DONO'?'Administrador':'Técnico'}</small></div></div></header><main className="content">{page==='dashboard'?<Dashboard token={sess.token} onGo={go}/>:page==='galpoes'?<Galpoes token={sess.token} onGo={go}/>:page==='novo'?<NovoGalpao token={sess.token} onGo={go}/>:page==='detalhe'?<Detalhe token={sess.token} id={selected} onGo={go} papel={sess.usuario.papel} usuario={sess.usuario}/>:page==='editar'&&sess.usuario.papel==='DONO'?<EditarGalpao token={sess.token} id={selected} onGo={go}/>:page==='funcionarios'&&sess.usuario.papel==='DONO'?<Funcionarios token={sess.token}/>:page==='lixeira'&&sess.usuario.papel==='DONO'?<LixeiraGalpoes token={sess.token} onGo={go}/>:page==='pendencias'&&sess.usuario.papel==='DONO'?<Pendencias token={sess.token} onGo={go}/>:null}</main><footer className="app-footer">VedaçãoHub 4.2 · Controle de obras</footer></div></div>
}

const root=document.getElementById('root'); if(root) createRoot(root).render(<App/>);
