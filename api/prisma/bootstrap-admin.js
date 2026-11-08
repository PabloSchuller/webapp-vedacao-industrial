/** Inicialização pontual para ambiente sem contas DEMO.
 * NUNCA use com contas já existentes; recusa criar segundo proprietário.
 * Uso: DEMO_SEED=false, definir ADMIN_EMAIL e ADMIN_PASSWORD, executar node prisma/bootstrap-admin.js.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {PrismaClient} from '@prisma/client';
const prisma=new PrismaClient();
async function main(){
  const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  const senha=process.env.ADMIN_PASSWORD||'';
  if(!email.includes('@')||senha.length<14)throw new Error('Informe ADMIN_EMAIL válido e ADMIN_PASSWORD com pelo menos 14 caracteres.');
  if(await prisma.usuario.count({where:{papel:'DONO'}}))throw new Error('Já existe proprietário. Use alteração de senha na aplicação; não crie outro.');
  const conta=await prisma.usuario.create({data:{email,nome:'Responsável',papel:'DONO',senhaHash:await bcrypt.hash(senha,12)}});
  console.log('Conta de proprietário criada:',conta.email);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
