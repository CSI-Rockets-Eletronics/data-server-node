-- CreateTable
CREATE TABLE "Session" (
    "environmentKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("environmentKey","name")
);

-- CreateTable
CREATE TABLE "Record" (
    "environmentKey" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "sentToParent" BOOLEAN NOT NULL DEFAULT false,
    "receivedAtIndex" SERIAL NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("environmentKey","device","ts")
);

-- CreateTable
CREATE TABLE "Message" (
    "environmentKey" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("environmentKey","device","ts")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_environmentKey_createdAt_key" ON "Session"("environmentKey", "createdAt");

-- CreateIndex
CREATE INDEX "Record_sentToParent_receivedAtIndex_idx" ON "Record"("sentToParent", "receivedAtIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Message_ts_key" ON "Message"("ts");
