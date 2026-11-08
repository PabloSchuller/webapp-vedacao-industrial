import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {PrismaClient} from '@prisma/client';
const prisma=new PrismaClient();
async function main(){
  if(process.env.DEMO_SEED !== 'true') throw new Error('Seed de demonstração desabilitada: defina DEMO_SEED=true.');
  const ownerEmail=(process.env.DEMO_OWNER_EMAIL||'dono@demo.local').toLowerCase();
  const ownerPwd=process.env.DEMO_OWNER_PASSWORD;
  const employeePwd=process.env.DEMO_EMPLOYEE_PASSWORD;
  if(!ownerPwd||ownerPwd.length<10||!employeePwd||employeePwd.length<10) throw new Error('Defina DEMO_OWNER_PASSWORD e DEMO_EMPLOYEE_PASSWORD (10+ caracteres).');
  const atualizarSenhas = process.env.DEMO_RESET_PASSWORDS==='true';
  const owner=await prisma.usuario.upsert({where:{email:ownerEmail},update:atualizarSenhas?{senhaHash:await bcrypt.hash(ownerPwd,12),tokenVersao:{increment:1}}:{},create:{nome:'Responsável Demo',email:ownerEmail,papel:'DONO',senhaHash:await bcrypt.hash(ownerPwd,12)}});
  await prisma.usuario.upsert({where:{email:'funcionario@demo.local'},update:atualizarSenhas?{senhaHash:await bcrypt.hash(employeePwd,12),tokenVersao:{increment:1}}:{},create:{nome:'Técnico Demo',email:'funcionario@demo.local',papel:'FUNCIONARIO',senhaHash:await bcrypt.hash(employeePwd,12)}});
  if(await prisma.galpao.count()===0){
    await prisma.galpao.createMany({data:[
      {nome:'Galpão Alpha (demonstração)',cliente:'Cliente Exemplo A',endereco:'Jaraguá do Sul, Santa Catarina, Brasil',dataInicio:new Date('2026-01-10T12:00:00Z'),latitude:-26.485,longitude:-49.066,progressoAtual:25,status:'EM_ANDAMENTO',descricao:'Dados fictícios: não representam cliente real.'},
      {nome:'Galpão Beta (demonstração)',cliente:'Cliente Exemplo B',endereco:'Guaramirim, Santa Catarina, Brasil',dataInicio:new Date('2026-02-15T12:00:00Z'),latitude:-26.473,longitude:-49.003,progressoAtual:0,status:'PLANEJADA',descricao:'Dados fictícios: não representam cliente real.'}
    ]});
  }
  console.log('Seed criada. Dono ID:',owner.id);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
