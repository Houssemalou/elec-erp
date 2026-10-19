-- Ajout du montant d'espèces en caisse à la clôture hebdomadaire
ALTER TABLE "weekly_closings"
  ADD COLUMN IF NOT EXISTS "cashOnHandTTC" DECIMAL(12,3) NOT NULL DEFAULT 0;
