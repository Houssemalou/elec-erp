-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_customerId_fkey";

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "customerName" TEXT,
ADD COLUMN "nonAssujettiTva" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;