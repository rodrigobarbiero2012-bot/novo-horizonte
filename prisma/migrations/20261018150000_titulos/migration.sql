-- CreateTable
CREATE TABLE "Titulo" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "contraparte" TEXT,
    "valorCentavos" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "contaId" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "linhaDigitavel" TEXT,
    "grupoParcelasId" TEXT,
    "parcela" INTEGER,
    "totalParcelas" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "baixadoEm" DATE,
    "valorBaixaCentavos" INTEGER,
    "contaBaixaId" TEXT,
    "lancamentoId" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_lancamentoId_key" ON "Titulo"("lancamentoId");

-- CreateIndex
CREATE INDEX "Titulo_status_vencimento_idx" ON "Titulo"("status", "vencimento");

-- CreateIndex
CREATE INDEX "Titulo_grupoParcelasId_idx" ON "Titulo"("grupoParcelasId");

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_contaBaixaId_fkey" FOREIGN KEY ("contaBaixaId") REFERENCES "Conta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

