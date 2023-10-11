-- CreateTable
CREATE TABLE "Session" (
    "environmentKey" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("environmentKey","session")
);

-- CreateTable
CREATE TABLE "Record" (
    "environmentKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "data" JSONB NOT NULL,
    "receivedAtIndex" SERIAL NOT NULL,
    "sentToParent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("environmentKey","path","ts")
);

-- CreateTable
CREATE TABLE "Message" (
    "environmentKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("ts")
);
