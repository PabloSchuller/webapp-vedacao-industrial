-- Extensão compatível com visitas legadas. Sem atualização de linhas.
ALTER TABLE "Visita"
    ADD COLUMN "registroFisico" JSONB,
    ALTER COLUMN "progressoAntes" DROP NOT NULL,
    ALTER COLUMN "progressoDepois" DROP NOT NULL;
