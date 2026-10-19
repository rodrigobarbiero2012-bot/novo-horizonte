-- AlterTable
ALTER TABLE "Titulo" ADD COLUMN     "financiamentoId" TEXT,
ADD COLUMN     "jurosCentavos" INTEGER;

-- CreateTable
CREATE TABLE "Financiamento" (
    "id" TEXT NOT NULL,
    "credor" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "contaPassivoId" TEXT NOT NULL,
    "contaJurosId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "taxaAnualPct" DOUBLE PRECISION NOT NULL,
    "sistema" TEXT NOT NULL,
    "periodicidadeMeses" INTEGER NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "carencia" INTEGER NOT NULL,
    "dataContratacao" DATE NOT NULL,
    "primeiroVencimento" DATE NOT NULL,
    "liberacaoLancamentoId" TEXT,
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Financiamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Financiamento_liberacaoLancamentoId_key" ON "Financiamento"("liberacaoLancamentoId");

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_financiamentoId_fkey" FOREIGN KEY ("financiamentoId") REFERENCES "Financiamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financiamento" ADD CONSTRAINT "Financiamento_contaPassivoId_fkey" FOREIGN KEY ("contaPassivoId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financiamento" ADD CONSTRAINT "Financiamento_contaJurosId_fkey" FOREIGN KEY ("contaJurosId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financiamento" ADD CONSTRAINT "Financiamento_liberacaoLancamentoId_fkey" FOREIGN KEY ("liberacaoLancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

