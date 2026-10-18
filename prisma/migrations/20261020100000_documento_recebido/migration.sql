-- CreateTable
CREATE TABLE "DocumentoRecebido" (
    "id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "legenda" TEXT,
    "anexoId" TEXT,
    "leitura" JSONB,
    "erro" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoRecebido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoRecebido_mensagemId_key" ON "DocumentoRecebido"("mensagemId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoRecebido_anexoId_key" ON "DocumentoRecebido"("anexoId");

-- CreateIndex
CREATE INDEX "DocumentoRecebido_status_idx" ON "DocumentoRecebido"("status");

-- AddForeignKey
ALTER TABLE "DocumentoRecebido" ADD CONSTRAINT "DocumentoRecebido_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "Anexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

