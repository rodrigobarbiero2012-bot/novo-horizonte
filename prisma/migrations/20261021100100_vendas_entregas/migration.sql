-- AlterTable
ALTER TABLE "Titulo" ADD COLUMN     "entregaId" TEXT;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "contaReceitaId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_entregaId_key" ON "Titulo"("entregaId");

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "MovimentoProducao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_contaReceitaId_fkey" FOREIGN KEY ("contaReceitaId") REFERENCES "Conta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

