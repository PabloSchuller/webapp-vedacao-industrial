export function calcularMetricas(avaliacoes){
  const t=avaliacoes.filter(a=>a.tipo==='TEMPO').map(a=>a.dados);
  const u=avaliacoes.filter(a=>a.tipo==='SUS').map(a=>a.dados);
  const c=avaliacoes.filter(a=>a.tipo==='CONSISTENCIA').map(a=>a.dados);
  const antes=t.reduce((n,x)=>n+x.antesSeg,0),depois=t.reduce((n,x)=>n+x.depoisSeg,0);
  const reducao=t.length?100*(1-depois/antes):null;
  const notas=u.map(x=>2.5*x.respostas.reduce((s,n,i)=>s+(i%2===0?n-1:5-n),0));
  const sus=notas.length?notas.reduce((a,b)=>a+b,0)/notas.length:null;
  const consistencia=c.length?100*c.filter(x=>x.consistente).length/c.length:null;
  const arred=n=>n==null?null:Math.round(n*100)/100;
  return {
    tempo:{estado:t.length?'medido':'nao_medido',amostras:t.length,mediaAntesSeg:t.length?arred(antes/t.length):null,mediaDepoisSeg:t.length?arred(depois/t.length):null,reducaoPercentual:arred(reducao),meta50:reducao===null?null:reducao>=50},
    sus:{estado:u.length?'medido':'nao_medido',participantes:u.length,pontuacaoMedia:arred(sus),meta70:sus===null?null:sus>=70},
    consistencia:{estado:c.length?'medido':'nao_medido',amostras:c.length,percentual:arred(consistencia),meta95:consistencia===null?null:consistencia>95},
    nota:'Resultados de estudo de caso interno da empresa do pesquisador. Amostras pequenas não permitem generalização.'
  };
}
