-- Clôtures hebdomadaires et créances clients libres.
--
-- Les deux complements du chiffre d'affaires automatique :
--   - la clôture hebdomadaire est saisie à la main (lundi → lundi) puis
--     verrouillée, pour fixer le résultat de la semaine ;
--   - la créance libre couvre une vente au comptant non facturée, là où le
--     module Paiements ne sait enregistrer que les factures.

CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

CREATE TABLE "receivables" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT NOT NULL,
  "amountTTC" DECIMAL(12,3) NOT NULL,
  "paidAmount" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "status" "ReceivableStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receivables_number_key" ON "receivables"("number");
CREATE INDEX "receivables_status_idx" ON "receivables"("status");
CREATE INDEX "receivables_dueDate_idx" ON "receivables"("dueDate");
CREATE INDEX "receivables_customerId_idx" ON "receivables"("customerId");

-- Un paiement peut viser soit une facture, soit une créance libre : au plus
-- une des deux cibles, et jamais les deux.
ALTER TABLE "payments"
  ADD COLUMN "receivableId" TEXT;

ALTER TABLE "receivables"
  ADD CONSTRAINT "receivables_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "receivables"
  ADD CONSTRAINT "receivables_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_receivableId_fkey"
  FOREIGN KEY ("receivableId") REFERENCES "receivables"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "payments_receivableId_idx" ON "payments"("receivableId");

-- Un paiement vise au plus une cible : une facture ou une créance libre, pas
-- les deux. `num_nonnulls` compte les valeurs non nulles.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_single_target"
  CHECK (num_nonnulls("invoiceId", "receivableId") <= 1);

CREATE TABLE "weekly_closings" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "revenueTTC" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "purchasesTTC" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "expensesTTC" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "otherExpensesTTC" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "weekly_closings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_closings_number_key" ON "weekly_closings"("number");
CREATE UNIQUE INDEX "weekly_closings_weekStart_key" ON "weekly_closings"("weekStart");

ALTER TABLE "weekly_closings"
  ADD CONSTRAINT "weekly_closings_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;