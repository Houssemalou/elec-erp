-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_customerId_fkey";

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "invoices" ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerMatricule" TEXT,
ADD COLUMN "customerAddress" TEXT,
ADD COLUMN "customerCity" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "credit_notes" DROP CONSTRAINT "credit_notes_customerId_fkey";

-- AlterTable
ALTER TABLE "credit_notes" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "credit_notes" ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerMatricule" TEXT,
ADD COLUMN "customerAddress" TEXT,
ADD COLUMN "customerCity" TEXT;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;