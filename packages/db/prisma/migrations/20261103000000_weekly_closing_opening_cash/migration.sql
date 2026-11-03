-- Report de caisse entre deux clôtures hebdomadaires.
--
-- Le montant resté en caisse à la fin d'une semaine est repris comme solde
-- d'ouverture de la semaine suivante et entre dans le calcul du résultat.
-- Backfill : chaque semaine hérite du cashOnHandTTC de la semaine précédente
-- lorsque celle-ci existe déjà.

ALTER TABLE "weekly_closings"
  ADD COLUMN IF NOT EXISTS "openingCashTTC" DECIMAL(12,3) NOT NULL DEFAULT 0;

UPDATE "weekly_closings" AS current
SET "openingCashTTC" = previous."cashOnHandTTC"
FROM "weekly_closings" AS previous
WHERE previous."weekStart" = current."weekStart" - INTERVAL '7 days';
