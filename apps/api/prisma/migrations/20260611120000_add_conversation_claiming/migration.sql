-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Conversation" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "claimedAt" TIMESTAMP(3);
