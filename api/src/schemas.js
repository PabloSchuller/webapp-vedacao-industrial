import {z} from 'zod';
import {registroFisicoSchema} from './registroFisico.js';
// bcrypt considera apenas os primeiros 72 bytes; rejeitar truncamento silencioso.
const novaSenha=z.string().min(10).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72,{message:'A senha deve ter no máximo 72 bytes em UTF-8.'});
export const loginSchema = z.object({email:z.string().email(), senha:z.string().min(1)});
export const usuarioSchema = z.object({nome:z.string().trim().min(2).max(120),email:z.string().email(), senha:novaSenha,papel:z.enum(['DONO','FUNCIONARIO']).default('FUNCIONARIO')});
const coord = (min,max) => z.number().min(min).max(max).nullable().optional();
export const galpaoSchema = z.object({nome:z.string().trim().min(3).max(160),cliente:z.string().trim().min(2).max(160),endereco:z.string().trim().min(8).max(500),dataInicio:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),status:z.enum(['PLANEJADA','PAUSADA','EM_ANDAMENTO']).default('PLANEJADA'),descricao:z.string().max(2000).optional().default(''),latitude:coord(-90,90),longitude:coord(-180,180)}).refine(v=>(v.latitude==null)===(v.longitude==null),{message:'Latitude e longitude devem ser informadas juntas.'});
// Atualização administrativa não modifica progresso: só visitas aprovadas podem alterá-lo.
export const galpaoEdicaoSchema = z.object({
  nome:z.string().trim().min(3).max(160),
  cliente:z.string().trim().min(2).max(160),
  endereco:z.string().trim().min(8).max(500),
  dataInicio:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:z.enum(['PLANEJADA','PAUSADA','EM_ANDAMENTO','CONCLUIDA']),
  descricao:z.string().max(2000).default(''),
  latitude:coord(-90,90),longitude:coord(-180,180)
}).refine(v=>(v.latitude==null)===(v.longitude==null),{message:'Latitude e longitude devem ser informadas juntas.'});
export const alterarUsuarioSchema = z.object({ativo:z.boolean()});
export const exclusaoGalpaoSchema = z.object({motivo:z.string().trim().min(5,'Informe uma justificativa com pelo menos 5 caracteres.').max(500)});
export const alterarSenhaSchema = z.object({senhaAtual:z.string().min(1),senhaNova:novaSenha}).refine(v=>v.senhaAtual!==v.senhaNova,{message:'A nova senha deve ser diferente da atual.',path:['senhaNova']});
export const visitaSchema = z.object({galpaoId:z.string().uuid(),dataVisita:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),descricao:z.string().trim().min(10).max(3000),registroFisico:registroFisicoSchema.optional(),progressoDepois:z.number().min(0).max(100).optional(),justificativa:z.string().max(2000).optional().default(''),proximosPassos:z.string().max(2000).optional().default(''),gpsLatitude:coord(-90,90),gpsLongitude:coord(-180,180)}).refine(v=>(v.gpsLatitude==null)===(v.gpsLongitude==null),{message:'Coordenadas GPS devem ser informadas juntas.'}).refine(v=>Boolean(v.registroFisico) !== (v.progressoDepois !== undefined), {message:'Informe o registro físico da visita ou o percentual legado, em formatos separados.'});
export const revisaoSchema = z.object({decisao:z.enum(['APROVAR','REJEITAR']),comentario:z.string().trim().min(3).max(2000)});
export function dataDb(value) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value) {const err=new Error('Data inválida.');err.httpStatus=400;throw err;}
  return date;
}
export function dataIso(value) { return new Date(value).toISOString().slice(0,10); }

export const fotoSchema = z.object({
  nome:z.string().trim().min(1).max(120),
  mime:z.enum(['image/jpeg','image/png','image/webp']),
  dadosBase64:z.string().min(16).max(4200000)
});
export const rotuloVisitaSchema = z.object({
  classe:z.enum(['TRABALHO_EXECUTADO','SEM_EXECUCAO','INDEFINIDO']),
  justificativa:z.string().trim().max(1000).default('')
});
export const filtrosVisitaSchema = z.object({
  inicio:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fim:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  revisao:z.enum(['APROVADA','PENDENTE','REJEITADA']).optional()
});

const participante = z.string().trim().min(2).max(80);
export const avaliacaoSchema = z.discriminatedUnion('tipo',[
  z.object({tipo:z.literal('TEMPO'),dados:z.object({participante,tarefa:z.string().trim().min(3).max(200),antesSeg:z.number().positive().max(3600),depoisSeg:z.number().positive().max(3600)})}),
  z.object({tipo:z.literal('SUS'),dados:z.object({participante,respostas:z.array(z.number().int().min(1).max(5)).length(10)})}),
  z.object({tipo:z.literal('CONSISTENCIA'),dados:z.object({registroRef:z.string().trim().min(3).max(200),consistente:z.boolean(),observacao:z.string().trim().max(1000).default('')})})
]);
