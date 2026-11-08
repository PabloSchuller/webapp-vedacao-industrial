/** Verificação de bytes reais, tamanho e nome; jamais confie somente no MIME informado. */
export const MAX_FOTO_BYTES=3 * 1024 * 1024;
export const MAX_FOTOS_POR_VISITA=12;
const tipos={
  'image/jpeg':b=>b.length>=4 && b[0]===0xff && b[1]===0xd8 && b[2]===0xff,
  'image/png':b=>b.length>=8 && b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),
  'image/webp':b=>b.length>=12 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP'
};
export function validarFoto({nome,mime,dadosBase64}){
  if(!tipos[mime])throw new Error('Formato não permitido. Use JPEG, PNG ou WebP.');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(dadosBase64) || dadosBase64.length%4!==0) throw new Error('Imagem em Base64 inválida.');
  const bytes=Buffer.from(dadosBase64,'base64');
  if(bytes.length<20||bytes.length>MAX_FOTO_BYTES)throw new Error('A imagem precisa ter entre 20 bytes e 3 MB.');
  if(!tipos[mime](bytes))throw new Error('Conteúdo não corresponde ao formato da imagem.');
  const nomeSeguro=nome.replace(/[\/\\\x00-\x1F]/g,'_').slice(0,120);
  return {nome:nomeSeguro,mime,tamanho:bytes.length,dados:bytes};
}
export const fotoProjection={id:true,autorId:true,visitaId:true,nome:true,mime:true,tamanho:true,criadoEm:true};
