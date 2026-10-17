-- CreateTable
CREATE TABLE "Cotacao" (
    "id" TEXT NOT NULL,
    "produto" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "origem" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cotacao_produto_data_idx" ON "Cotacao"("produto", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Cotacao_produto_data_key" ON "Cotacao"("produto", "data");

