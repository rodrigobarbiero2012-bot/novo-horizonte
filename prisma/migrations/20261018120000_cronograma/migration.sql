-- CreateTable
CREATE TABLE "TarefaCronograma" (
    "id" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "etapa" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mesInicio" INTEGER NOT NULL,
    "mesFim" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "concluidaPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarefaCronograma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TarefaCronograma_atividade_ano_idx" ON "TarefaCronograma"("atividade", "ano");

-- AddForeignKey
ALTER TABLE "TarefaCronograma" ADD CONSTRAINT "TarefaCronograma_concluidaPorId_fkey" FOREIGN KEY ("concluidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

