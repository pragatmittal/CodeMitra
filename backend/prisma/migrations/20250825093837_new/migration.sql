-- CreateTable
CREATE TABLE "public"."code_executions" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "executionTime" INTEGER,
    "memoryUsed" INTEGER,
    "compilationTime" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "code_executions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."code_executions" ADD CONSTRAINT "code_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."code_executions" ADD CONSTRAINT "code_executions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
