-- CreateTable
CREATE TABLE "PathInstance" (
    "environmentKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathInstance_pkey" PRIMARY KEY ("environmentKey","path")
);

-- CreateTable
CREATE TABLE "Record" (
    "environmentKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("environmentKey","path","ts")
);

-- CreateTable
CREATE TABLE "Message" (
    "environmentKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("environmentKey","path","receivedAt")
);

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_environmentKey_path_fkey" FOREIGN KEY ("environmentKey", "path") REFERENCES "PathInstance"("environmentKey", "path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_environmentKey_path_fkey" FOREIGN KEY ("environmentKey", "path") REFERENCES "PathInstance"("environmentKey", "path") ON DELETE RESTRICT ON UPDATE CASCADE;
