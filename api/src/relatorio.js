// Relatório offline imprimível, sem dependências externas e sem HTML vindo do usuário.
export function escaparHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function registroDaVisita(v) {
  const esc = escaparHtml;
  const r = v.registroFisico;
  if (!r) return v.progressoDepois == null ? '—' : `Medição histórica: ${esc(v.progressoAntes)}% → ${esc(v.progressoDepois)}%`;
  const linhas = [esc(r.situacao)];
  const grupos = {servicos:'Serviços', materiaisUtilizados:'Utilizados', materiaisRestantes:'Restantes', materiaisNecessarios:'Necessários'};
  for (const [campo, titulo] of Object.entries(grupos)) {
    for (const i of r[campo] ?? []) linhas.push(`${titulo}: ${esc(i.nome)} — ${esc(i.quantidade)} ${esc(i.unidade)}`);
  }
  if (r.motivo) linhas.push('Motivo: ' + esc(r.motivo));
  if (r.impedimentos) linhas.push('Impedimentos: ' + esc(r.impedimentos));
  return linhas.join('<br>');
}
export function relatorioGalpao(g){
  const esc=escaparHtml;
  const iso=v=>v?new Date(v).toISOString().slice(0,10):'—';
  const visitas=[...g.visitas].sort((a,b)=>new Date(a.dataVisita)-new Date(b.dataVisita));
  const linhas=visitas.map(v=>`<tr><td>${esc(iso(v.dataVisita))}</td><td>${esc(v.autor?.nome)}</td><td>${esc(v.descricao)}</td><td>${registroDaVisita(v)}</td><td>${esc(v.revisao)}</td><td>${esc(v.iaClasse??'—')}</td><td>${esc(v.proximosPassos??'')}</td></tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${esc(g.nome)}</title><style>body{font:14px Arial,sans-serif;color:#1a2533;margin:32px}h1{margin-bottom:0}small{color:#556}dl{display:grid;grid-template-columns:140px 1fr;gap:8px}dt{font-weight:700}table{border-collapse:collapse;width:100%;margin-top:18px;font-size:11px}td,th{border:1px solid #ccc;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#edf3f8}@media print{body{margin:10mm}button{display:none}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><button onclick="window.print()">Imprimir / salvar em PDF</button><h1>Histórico de obra — ${esc(g.nome)}</h1><small>VedaçãoHub · Exportação ${esc(new Date().toISOString().slice(0,10))} · uso interno</small><dl><dt>Cliente</dt><dd>${esc(g.cliente)}</dd><dt>Endereço</dt><dd>${esc(g.endereco)}</dd><dt>Início</dt><dd>${esc(iso(g.dataInicio))}</dd><dt>Situação</dt><dd>${esc(g.status)}</dd><dt>Visitas</dt><dd>${visitas.length}</dd></dl><h2>Visitas registradas</h2><table><thead><tr><th>Data</th><th>Técnico</th><th>Relato</th><th>Registro da visita</th><th>Revisão</th><th>IA</th><th>Próximos passos</th></tr></thead><tbody>${linhas||'<tr><td colspan="7">Sem visitas</td></tr>'}</tbody></table><p><small>Relatório gerado a partir do histórico do sistema. Alertas de IA são auxiliares e não substituem avaliação profissional.</small></p></body></html>`;
}
