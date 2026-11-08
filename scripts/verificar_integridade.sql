-- Somente leitura. Compara quantidade e digest de todas as linhas, sem exportá-las.
SELECT 'Usuario',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "Usuario" t
UNION ALL SELECT 'Galpao',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "Galpao" t
UNION ALL SELECT 'Visita',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "Visita" t
UNION ALL SELECT 'Auditoria',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "Auditoria" t
UNION ALL SELECT 'FotoVisita',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "FotoVisita" t
UNION ALL SELECT 'RotuloVisita',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "RotuloVisita" t
UNION ALL SELECT 'AvaliacaoTcc',count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) FROM "AvaliacaoTcc" t;
