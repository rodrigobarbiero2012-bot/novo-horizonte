-- CreateTable
CREATE TABLE "Talhao" (
    "id" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "variedade" TEXT,
    "anoPlantio" INTEGER,
    "plantas" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoProducao" (
    "id" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "talhaoId" TEXT,
    "valorCentavos" INTEGER,
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoProducao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Talhao_atividade_idx" ON "Talhao"("atividade");

-- CreateIndex
CREATE INDEX "MovimentoProducao_atividade_data_idx" ON "MovimentoProducao"("atividade", "data");

-- AddForeignKey
ALTER TABLE "MovimentoProducao" ADD CONSTRAINT "MovimentoProducao_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

