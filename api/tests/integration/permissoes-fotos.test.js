import test from 'node:test';
import assert from 'node:assert/strict';
if(!process.env.DATABASE_URL?.includes('/vedacao_test?'))throw new Error('Somente banco de testes.');
const base='http://127.0.0.1:3001';
test('metadados de fotos expõem autoria e API impede alterações por outro técnico',async()=>{
  async function request(path,{token,body,method='GET',status=200}={}){
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
    const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;
  }
  const owner=await request('/auth/login',{method:'POST',body:{email:'dono@demo.local',senha:process.env.DEMO_OWNER_PASSWORD}});
  const senha=crypto.randomUUID(); const email=`permissoes${Date.now()}@example.invalid`;
  const user=await request('/usuarios',{token:owner.token,method:'POST',status:201,body:{nome:'Técnico permissão teste',email,senha}});
  const employee=await request('/auth/login',{method:'POST',body:{email,senha}});
  const g=await request('/galpoes',{token:owner.token,method:'POST',status:201,body:{nome:`Permissões fotos ${Date.now()}`,cliente:'Cliente fictício',endereco:'Endereço fictício para teste local',dataInicio:'2026-01-01'}});
  const {visita}=await request('/visitas',{token:owner.token,method:'POST',status:201,body:{galpaoId:g.id,dataVisita:'2026-01-02',descricao:'Nenhuma atividade foi realizada por falta de materiais.',progressoDepois:0}});
  const foto={nome:'teste.png',mime:'image/png',dadosBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c8mQAAAAASUVORK5CYII='};
  const uploaded=await request(`/visitas/${visita.id}/fotos`,{token:owner.token,method:'POST',body:foto,status:201});
  assert.equal(uploaded.autorId,owner.usuario.id);
  const list=await request(`/visitas/${visita.id}/fotos`,{token:employee.token});assert.equal(list[0].autorId,owner.usuario.id);
  await request(`/visitas/${visita.id}/fotos`,{token:employee.token,method:'POST',body:foto,status:403});
  await request(`/fotos/${uploaded.id}`,{token:employee.token,method:'DELETE',status:403});
  assert.equal((await request(`/visitas/${visita.id}/fotos`,{token:owner.token})).length,1);
  console.log(JSON.stringify({browserFixture:{email,userId:user.id,galpaoId:g.id,nome:g.nome}}));
});
