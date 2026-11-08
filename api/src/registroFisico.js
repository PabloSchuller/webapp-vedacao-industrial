import {z} from 'zod';

const item = z.object({
  nome: z.string().trim().min(1, 'Informe o serviço ou material.').max(160),
  quantidade: z.number({error:'Informe uma quantidade numérica.'}).finite().nonnegative('A quantidade deve ser zero ou positiva.'),
  unidade: z.string().trim().min(1, 'Informe a unidade de medida.').max(32)
}).strict();

const medicao = item.refine(i => i.quantidade > 0, 'A quantidade deve ser maior que zero.');
const lista = tipo => z.array(tipo).max(100).default([]);

export const registroFisicoSchema = z.object({
  situacao: z.enum(['TRABALHO_EXECUTADO', 'SEM_EXECUCAO', 'INDEFINIDO']),
  servicos: lista(medicao),
  materiaisUtilizados: lista(medicao),
  materiaisRestantes: lista(item),
  materiaisNecessarios: lista(medicao),
  impedimentos: z.string().trim().max(2000).default(''),
  motivo: z.string().trim().max(2000).default('')
}).strict().superRefine((r, ctx) => {
  const erro = (campo, message) => ctx.addIssue({code:'custom', path:[campo], message});
  if (r.situacao === 'TRABALHO_EXECUTADO' && !r.servicos.length)
    erro('servicos', 'Registre ao menos um serviço com quantidade e unidade.');
  if (r.situacao !== 'TRABALHO_EXECUTADO' && r.servicos.length)
    erro('servicos', 'Serviços executados exigem situação de trabalho executado.');
  if (r.situacao === 'SEM_EXECUCAO' && !r.motivo)
    erro('motivo', 'Informe o motivo da visita sem execução.');
});
