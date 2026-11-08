import {z} from 'zod';

// Resposta incompleta nunca equivale a autorização automática da visita.
const respostaSchema=z.object({
  classificacao_ia:z.enum(['TRABALHO_EXECUTADO','SEM_EXECUCAO','INDEFINIDO']),
  score_modelo:z.number().finite().min(0).max(1),
  versao_modelo:z.string().min(1).max(200),
  avisos:z.array(z.string().max(2000)).max(30)
});
export async function consultarIA(d,progressoAntes,fetcher=fetch){
  try {
    const response=await fetcher(`${process.env.IA_URL||'http://localhost:8000'}/classificar`,{
      method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(3000),
      body:JSON.stringify({descricao:d.descricao,percentual_anterior:d.registroFisico ? undefined : progressoAntes,percentual_atual:d.progressoDepois})
    });
    if(!response.ok)throw new Error('IA indisponível');
    return respostaSchema.parse(await response.json());
  }catch{return {indisponivel:true,avisos:[]};}
}
