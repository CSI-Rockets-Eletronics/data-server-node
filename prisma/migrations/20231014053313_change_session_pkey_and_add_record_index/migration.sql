/*
  Warnings:

  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey",
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("environmentKey", "createdAt");

-- CreateIndex
CREATE INDEX "Message_environmentKey_path_ts_idx" ON "Message"("environmentKey", "path", "ts");
