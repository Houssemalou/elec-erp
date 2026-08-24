-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('MANUAL', 'POS');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "source" "InvoiceSource" NOT NULL DEFAULT 'MANUAL';
