-- AlterTable
ALTER TABLE "LobbyMessage" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "LobbyMessage_sessionId_idx" ON "LobbyMessage"("sessionId");

-- CreateTable
CREATE TABLE "GameWin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameWin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameWin_userId_createdAt_idx" ON "GameWin"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameWin" ADD CONSTRAINT "GameWin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
