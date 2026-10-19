-- AlterTable
ALTER TABLE "MovimentoProducao" ADD COLUMN     "vendaId" TEXT;

-- AlterTable
ALTER TABLE "Titulo" ADD COLUMN     "vendaId" TEXT;

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "comprador" TEXT NOT NULL,
    "dataContrato" DATE NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "precoUnitarioCentavos" INTEGER,
    "modalidade" TEXT NOT NULL,
    "entregaPrevista" DATE,
    "pagamentoPrevisto" DATE,
    "observacao" TEXT,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Venda_atividade_dataContrato_idx" ON "Venda"("atividade", "dataContrato");

-- CreateIndex
CREATE INDEX "MovimentoProducao_vendaId_idx" ON "MovimentoProducao"("vendaId");

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoProducao" ADD CONSTRAINT "MovimentoProducao_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

