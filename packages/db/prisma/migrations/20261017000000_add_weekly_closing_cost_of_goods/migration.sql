-- Coût de revient TTC des articles vendus, par semaine.
--
-- Alimenté automatiquement à partir des ventes enregistrées (factures et ventes
-- caisse sans facture) puis ajustable à la main. Permet de calculer la marge
-- brute de la semaine = chiffre d'affaires TTC − coût de revient TTC, distincte
-- du résultat net qui retient aussi les achats, dépenses et autres dépenses.

ALTER TABLE "weekly_closings"
  ADD COLUMN "costOfGoodsTTC" DECIMAL(12,3) NOT NULL DEFAULT 0;
