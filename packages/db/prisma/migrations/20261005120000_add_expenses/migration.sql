-- Dépenses (charges hors achats) : loyer, salaires, énergie, transport…
--
-- L'entreprise n'étant pas assujettie à la TVA, la dépense est saisie et
-- stockée en TTC (montant réellement payé) ; il n'y a pas de base HT ni de TVA
-- déductible à renseigner.
CREATE TYPE "ExpenseCategory" AS ENUM (
  'LOYER',
  'SALAIRES',
  'ELECTRICITE',
  'TRANSPORT',
  'FOURNITURES',
  'IMPOTS',
  'AUTRE'
);

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL DEFAULT 'AUTRE',
  "amountTTC" DECIMAL(12,3) NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expenses_number_key" ON "expenses"("number");
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
