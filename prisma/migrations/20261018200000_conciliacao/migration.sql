-- CreateTable
CREATE TABLE "ImportacaoExtrato" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "banco" TEXT,
    "inicio" DATE,
    "fim" DATE,
    "saldoFinalCentavos" INTEGER,
    "dataSaldo" DATE,
    "novas" INTEGER NOT NULL,
    "repetidas" INTEGER NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoExtrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransacaoBancaria" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "fitid" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "partidaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransacaoBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransacaoBancaria_partidaId_key" ON "TransacaoBancaria"("partidaId");

-- CreateIndex
CREATE INDEX "TransacaoBancaria_contaId_status_data_idx" ON "TransacaoBancaria"("contaId", "status", "data");

-- CreateIndex
CREATE UNIQUE INDEX "TransacaoBancaria_contaId_fitid_key" ON "TransacaoBancaria"("contaId", "fitid");

-- AddForeignKey
ALTER TABLE "ImportacaoExtrato" ADD CONSTRAINT "ImportacaoExtrato_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoBancaria" ADD CONSTRAINT "TransacaoBancaria_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoExtrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoBancaria" ADD CONSTRAINT "TransacaoBancaria_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

