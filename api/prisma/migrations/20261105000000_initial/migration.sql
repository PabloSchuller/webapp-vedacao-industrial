-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DONO', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'PAUSADA');

-- CreateEnum
CREATE TYPE "Revisao" AS ENUM ('APROVADA', 'PENDENTE', 'REJEITADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'FUNCIONARIO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersao" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Galpao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "dataInicio" DATE NOT NULL,
    "status" "EstadoObra" NOT NULL DEFAULT 'PLANEJADA',
    "progressoAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),
    "motivoExclusao" TEXT,
    "excluidoPorId" TEXT,

    CONSTRAINT "Galpao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visita" (
    "id" TEXT NOT NULL,
    "galpaoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "revisorId" TEXT,
    "dataVisita" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "progressoAntes" DOUBLE PRECISION NOT NULL,
    "progressoDepois" DOUBLE PRECISION NOT NULL,
    "justificativa" TEXT,
    "proximosPassos" TEXT,
    "gpsLatitude" DOUBLE PRECISION,
    "gpsLongitude" DOUBLE PRECISION,
    "iaClasse" TEXT,
    "iaConfianca" DOUBLE PRECISION,
    "iaVersao" TEXT,
    "revisao" "Revisao" NOT NULL DEFAULT 'APROVADA',
    "bloqueios" JSONB NOT NULL DEFAULT '[]',
    "avisos" JSONB NOT NULL DEFAULT '[]',
    "comentarioRevisao" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoVisita" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluidaEm" TIMESTAMP(3),

    CONSTRAINT "FotoVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotuloVisita" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotuloVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoTcc" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluidoEm" TIMESTAMP(3),

    CONSTRAINT "AvaliacaoTcc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Galpao_nome_idx" ON "Galpao"("nome");

-- CreateIndex
CREATE INDEX "Galpao_excluidoEm_idx" ON "Galpao"("excluidoEm");

-- CreateIndex
CREATE INDEX "Visita_galpaoId_dataVisita_idx" ON "Visita"("galpaoId", "dataVisita");

-- CreateIndex
CREATE INDEX "Auditoria_entidade_entidadeId_idx" ON "Auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "FotoVisita_visitaId_excluidaEm_idx" ON "FotoVisita"("visitaId", "excluidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "RotuloVisita_visitaId_key" ON "RotuloVisita"("visitaId");

-- CreateIndex
CREATE INDEX "AvaliacaoTcc_tipo_excluidoEm_idx" ON "AvaliacaoTcc"("tipo", "excluidoEm");

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_galpaoId_fkey" FOREIGN KEY ("galpaoId") REFERENCES "Galpao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_revisorId_fkey" FOREIGN KEY ("revisorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoVisita" ADD CONSTRAINT "FotoVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoVisita" ADD CONSTRAINT "FotoVisita_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotuloVisita" ADD CONSTRAINT "RotuloVisita_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotuloVisita" ADD CONSTRAINT "RotuloVisita_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoTcc" ADD CONSTRAINT "AvaliacaoTcc_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
