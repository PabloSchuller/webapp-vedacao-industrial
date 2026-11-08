import {z} from 'zod';

const servico = z.object({
  nome: z.string().trim().min(1, 'Informe o serviço ou material.').max(160)
}).strict();

const material = servico.extend({
  quantidade: z.number({error:'Informe uma quantidade numérica.'}).finite().nonnegative('A quantidade deve ser zero ou positiva.')
}).strict();

const medicao = material.refine(i => i.quantidade > 0, 'A quantidade deve ser maior que zero.');
const lista = tipo => z.array(tipo).max(100).default([]);

export const registroFisicoSchema = z.object({
  situacao: z.enum(['TRABALHO_EXECUTADO', 'SEM_EXECUCAO', 'INDEFINIDO']),
  servicos: lista(servico),
  materiaisUtilizados: lista(medicao),
  materiaisRestantes: lista(material),
  materiaisNecessarios: lista(medicao),
  impedimentos: z.string().trim().max(2000).optional(),
  motivo: z.string().trim().max(2000).optional()
}).strict().superRefine((r, ctx) => {
  const erro = (campo, message) => ctx.addIssue({code:'custom', path:[campo], message});
  if (r.situacao !== 'TRABALHO_EXECUTADO' && r.servicos.length)
    erro('servicos', 'Serviços executados exigem situação de trabalho executado.');
});
