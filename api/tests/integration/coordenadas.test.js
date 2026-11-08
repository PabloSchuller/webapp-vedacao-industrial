import test from 'node:test';
import assert from 'node:assert/strict';
if(!process.env.DATABASE_URL?.includes('/vedacao_test?'))throw new Error('Teste restrito ao banco vedacao_test.');
const base='http://127.0.0.1:3001';
test('coordenadas persistem em POST/GET/PATCH, aceitam zero e rejeitam alterações inválidas',async()=>{
  const login=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'dono@demo.local',senha:process.env.DEMO_OWNER_PASSWORD})});
  assert.equal(login.status,200);const {token}=await login.json();
  async function request(path,method='GET',body,status=200){
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;
  }
  const dados={nome:`Coordenadas isoladas ${Date.now()}`,cliente:'Cliente fictício',endereco:'Endereço fictício de teste 123',dataInicio:'2026-01-01',status:'PLANEJADA',latitude:-26.4785057,longitude:-49.0856051};
  const g=await request('/galpoes','POST',dados,201);const path=`/galpoes/${g.id}`;
  let saved=await request(path);assert.equal(saved.latitude,dados.latitude);assert.equal(saved.longitude,dados.longitude);
  for(const [latitude,longitude] of [[-26.4778527,-49.0864849],[0,0]]){
    await request(path,'PATCH',{...dados,latitude,longitude});saved=await request(path);assert.equal(saved.latitude,latitude);assert.equal(saved.longitude,longitude);
  }
  for(const change of [{latitude:91,longitude:0},{latitude:0,longitude:181},{latitude:null,longitude:0}])await request(path,'PATCH',{...dados,...change},400);
  saved=await request(path);assert.equal(saved.latitude,0);assert.equal(saved.longitude,0);
  await request('/geo/geocodificar?endereco=a','GET',undefined,400);
  assert.equal((await fetch(`${base}/geo/geocodificar?endereco=Endereco+publico`)).status,401);
});
