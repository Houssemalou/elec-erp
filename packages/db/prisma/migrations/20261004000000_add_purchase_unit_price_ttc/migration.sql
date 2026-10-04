-- Les achats suivent la même logique que la vente : le prix d'achat est saisi
-- en TTC (prix maître, affiché tel quel sur la facture d'achat) et le HT en
-- découle. Ces deux colonnes manquaient sur purchase_invoice_items, donc le PU
-- TTC saisi était perdu et seul le HT déduit restait lisible.
ALTER TABLE "purchase_invoice_items"
  ADD COLUMN "unitPriceTTC" DECIMAL(12,3),
  ADD COLUMN "netUnitPriceTTC" DECIMAL(12,3);

-- Lignes existantes : TTC = HT x (1 + taux) de la ligne, arrondi au millime.
UPDATE purchase_invoice_items pii
SET "unitPriceTTC" = round(pii."unitPriceHT" * (1 + tr."rate" / 100), 3),
    "netUnitPriceTTC" = round(pii."netUnitPrice" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE pii."taxRateId" = tr.id;
