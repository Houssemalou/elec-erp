-- Décaissements rattachés à une vente en caisse + catégorie « Dette ».
--
-- Permet d'enregistrer, au moment de la vente, où va l'argent encaissé
-- (par exemple payer une dette) : chaque affectation est une dépense liée au
-- bon de livraison, suivie par le module Dépenses.

ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'DETTE';

ALTER TABLE "expenses"
  ADD COLUMN "deliveryNoteId" TEXT;

CREATE INDEX "expenses_deliveryNoteId_idx" ON "expenses"("deliveryNoteId");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_deliveryNoteId_fkey"
  FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
