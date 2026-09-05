-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryNoteSource" AS ENUM ('POS', 'MANUAL');

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "source" "DeliveryNoteSource" NOT NULL DEFAULT 'POS',
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'VALIDATED',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalHT" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_items" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPriceHT" DECIMAL(12,3) NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "lineTVA" DECIMAL(12,3) NOT NULL,
    "lineTTC" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_number_key" ON "delivery_notes"("number");

-- CreateIndex
CREATE INDEX "delivery_notes_customerId_idx" ON "delivery_notes"("customerId");

-- CreateIndex
CREATE INDEX "delivery_notes_invoiceId_idx" ON "delivery_notes"("invoiceId");

-- CreateIndex
CREATE INDEX "delivery_notes_issueDate_idx" ON "delivery_notes"("issueDate");

-- CreateIndex
CREATE INDEX "delivery_note_items_deliveryNoteId_idx" ON "delivery_note_items"("deliveryNoteId");

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
