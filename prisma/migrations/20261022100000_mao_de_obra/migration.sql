-- CreateTable
CREATE TABLE "Trabalhador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "diariaCentavos" INTEGER,
    "precoUnidadeCentavos" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trabalhador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apontamento" (
    "id" TEXT NOT NULL,
    "trabalhadorId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "atividade" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "dias" DOUBLE PRECISION NOT NULL,
    "quantidade" DOUBLE PRECISION,
    "valorCentavos" INTEGER NOT NULL,
    "contaId" TEXT NOT NULL,
    "fechamentoId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Apontamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechamentoMaoDeObra" (
    "id" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "dataPagamento" DATE NOT NULL,
    "contaPagamentoId" TEXT NOT NULL,
    "totalCentavos" INTEGER NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FechamentoMaoDeObra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Apontamento_data_idx" ON "Apontamento"("data");

-- CreateIndex
CREATE INDEX "Apontamento_fechamentoId_idx" ON "Apontamento"("fechamentoId");

-- CreateIndex
CREATE INDEX "Apontamento_trabalhadorId_data_idx" ON "Apontamento"("trabalhadorId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoMaoDeObra_lancamentoId_key" ON "FechamentoMaoDeObra"("lancamentoId");

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_trabalhadorId_fkey" FOREIGN KEY ("trabalhadorId") REFERENCES "Trabalhador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "FechamentoMaoDeObra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoMaoDeObra" ADD CONSTRAINT "FechamentoMaoDeObra_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

