/** Regras determinísticas independentes da classificação por IA. */
export function validarObjetivamente({ dataInicio, dataVisita, ultimaVisita, progressoAntes, progressoDepois, justificativa }) {
  const bloqueios = [];
  const avisos = [];
  if (dataVisita < dataInicio) bloqueios.push('A visita não pode anteceder a data de início do galpão.');
  if (ultimaVisita && dataVisita < ultimaVisita) bloqueios.push('A visita não pode anteceder a última visita aprovada.');
  if (progressoDepois == null) return {bloqueios, avisos};
  if (!Number.isFinite(progressoDepois) || progressoDepois < 0 || progressoDepois > 100) bloqueios.push('O progresso deve estar entre 0 e 100%.');
  if (progressoDepois < progressoAntes) {
    if (!justificativa?.trim()) bloqueios.push('O progresso diminuiu sem justificativa.');
    else avisos.push('Redução de progresso justificada: é necessária aprovação do responsável.');
  }
  return { bloqueios, avisos };
}

/** Distância aproximada sobre a superfície terrestre; não é validação de endereço postal. */
export function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(lat2-lat1)/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
export function combinarValidacao(regras, ia, distancia) {
  const bloqueios = [...regras.bloqueios];
  const avisos = [...regras.avisos, ...(ia?.avisos ?? [])];
  if (ia?.indisponivel) avisos.push('IA indisponível; registro depende de revisão humana.');
  if (distancia != null && distancia > 200) avisos.push(`Localização informada a ${Math.round(distancia)} m do galpão; verificar GPS.`);
  const status = bloqueios.length ? 'BLOQUEAR' : avisos.length ? 'REVISAR' : 'APROVAR';
  return { status, bloqueios, avisos, iaClasse: ia?.classificacao_ia ?? null, iaConfianca: ia?.score_modelo ?? null, iaVersao: ia?.versao_modelo ?? null, distanciaMetros: distancia == null ? null : Math.round(distancia) };
}

/** Restrições administrativas: edição não reescreve o progresso nem invalida visitas. */
export function validarEdicaoGalpao(_galpao, edicao, primeiraVisitaIso=null) {
  const bloqueios=[];
  if(primeiraVisitaIso && edicao.dataInicio>primeiraVisitaIso) bloqueios.push('A data de início não pode ficar depois de visitas já registradas.');
  return bloqueios;
}
