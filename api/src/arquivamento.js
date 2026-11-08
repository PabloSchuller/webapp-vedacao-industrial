/** Política de exclusão reversível: nunca apagar dados históricos em cascata. */
export function verificarExclusao(galpao,pendentes){
  if(!galpao || galpao.excluidoEm)return {status:404,erro:'Galpão não encontrado entre os ativos.'};
  if(pendentes>0)return {status:409,erro:'Revise as visitas pendentes antes de excluir o galpão.'};
  return {status:200,erro:null};
}
export function verificarRestauracao(galpao){
  if(!galpao || !galpao.excluidoEm)return {status:404,erro:'Galpão não está na lixeira.'};
  return {status:200,erro:null};
}
