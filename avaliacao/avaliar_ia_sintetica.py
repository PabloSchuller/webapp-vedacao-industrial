"""Avalia o modelo disponível no holdout sintético original, sem treinar novamente."""
import argparse,hashlib,json,sys
from pathlib import Path
import joblib,pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score,f1_score,classification_report,confusion_matrix
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'ia'))
from treinar import baseline,CLASSES,SEMENTE

def executar(modelo,dados,saida):
    df=pd.read_csv(dados).dropna(subset=['descricao','classe'])
    df['descricao']=df['descricao'].astype(str).str.strip()
    df=df[df['descricao'].str.len()>=10].drop_duplicates(subset=['descricao'])
    xt,xv,yt,yv=train_test_split(df['descricao'],df['classe'],test_size=.25,random_state=SEMENTE,stratify=df['classe'])
    fitted=joblib.load(modelo)
    predicted=fitted.predict(xv)
    heuristic=[baseline(t) for t in xv]
    matrix=confusion_matrix(yv,predicted,labels=CLASSES)
    result={'tipo_dados':'sinteticos','avaliacao':'holdout original reutilizado para verificação técnica; não é teste externo independente','treino':len(xt),'teste':len(xv),'semente':SEMENTE,'classes':CLASSES,'textos_identicos_entre_treino_teste':len(set(xt)&set(xv)),
      'sha256_modelo':hashlib.sha256(Path(modelo).read_bytes()).hexdigest(),'sha256_dados':hashlib.sha256(Path(dados).read_bytes()).hexdigest(),
      'acuracia':float(accuracy_score(yv,predicted)),'f1_macro':float(f1_score(yv,predicted,labels=CLASSES,average='macro',zero_division=0)),
      'f1_macro_baseline':float(f1_score(yv,heuristic,labels=CLASSES,average='macro',zero_division=0)),
      'matriz_confusao':matrix.tolist(),'por_classe':classification_report(yv,predicted,labels=CLASSES,output_dict=True,zero_division=0),
      'erros_por_classe':{c:{'falsos_positivos':int(matrix[:,i].sum()-matrix[i,i]),'falsos_negativos':int(matrix[i,:].sum()-matrix[i,i])} for i,c in enumerate(CLASSES)},
      'erros':[{'descricao':text,'esperado':truth,'previsto':prediction} for text,truth,prediction in zip(xv,yv,predicted) if truth!=prediction],
      'limites':'Base pequena e sintética, possível similaridade temática entre partições. Não estima SUS, ganho de tempo, consistência de campo ou generalização.'}
    Path(saida).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:result[k] for k in ['tipo_dados','treino','teste','acuracia','f1_macro','f1_macro_baseline','erros_por_classe']},ensure_ascii=False,indent=2))
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--modelo',required=True);parser.add_argument('--dados',required=True);parser.add_argument('--saida',required=True)
    args=parser.parse_args();executar(args.modelo,args.dados,args.saida)
