-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "conviteExpiraEm" TIMESTAMP(3),
ADD COLUMN     "conviteHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_conviteHash_key" ON "Usuario"("conviteHash");

