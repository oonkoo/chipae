-- AlterTable
ALTER TABLE "GameWin" ADD COLUMN "lobbyId" TEXT;
ALTER TABLE "GameWin" ADD COLUMN "players" JSONB;

-- CreateIndex
CREATE INDEX "GameWin_lobbyId_createdAt_idx" ON "GameWin"("lobbyId", "createdAt");
