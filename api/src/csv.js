/** Protege exportações de CSV contra quebra de célula e execução de fórmulas. */
export function csvCelula(valor) {
  let v=String(valor??'').replaceAll('\r',' ').replaceAll('\n',' ');
  if(/^[\s]*[=+\-@]/.test(v))v="'"+v;
  return '"'+v.replaceAll('"','""')+'"';
}
