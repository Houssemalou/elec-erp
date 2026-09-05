-- DropForeignKey
ALTER TABLE "delivery_notes" DROP CONSTRAINT "delivery_notes_customerId_fkey";

-- AlterTable
ALTER TABLE "delivery_notes" ALTER COLUMN "customerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
