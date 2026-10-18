-- CreateTable
CREATE TABLE "OrcamentoItem" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "linha" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrcamentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrcamentoItem_ano_linha_mes_key" ON "OrcamentoItem"("ano", "linha", "mes");

