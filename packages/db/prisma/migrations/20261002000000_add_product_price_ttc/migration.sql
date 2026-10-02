-- Prix de vente TTC saisi : c'est le prix maître. Le HT est déduit du TTC
-- (HT = TTC / (1 + taux)) et la TVA vaut TTC - HT, donc le TTC affiché sur la
-- facture, le devis ou le ticket de caisse reste exactement la valeur saisie.
ALTER TABLE "products" ADD COLUMN "priceTTC" DECIMAL(12,3);

-- Reprise des prix existants : TTC = HT x (1 + taux), arrondi au millime.
UPDATE products p
SET "priceTTC" = round(p."priceHT" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE p."taxRateId" = tr.id AND p."priceTTC" IS NULL;

ALTER TABLE "quote_items"
  ADD COLUMN "unitPriceTTC" DECIMAL(12,3),
  ADD COLUMN "netUnitPriceTTC" DECIMAL(12,3);

ALTER TABLE "invoice_items"
  ADD COLUMN "unitPriceTTC" DECIMAL(12,3),
  ADD COLUMN "netUnitPriceTTC" DECIMAL(12,3);

ALTER TABLE "credit_note_items"
  ADD COLUMN "unitPriceTTC" DECIMAL(12,3),
  ADD COLUMN "netUnitPriceTTC" DECIMAL(12,3);

ALTER TABLE "delivery_note_items" ADD COLUMN "unitPriceTTC" DECIMAL(12,3);

ALTER TABLE "online_order_items"
  ADD COLUMN "unitPriceTTC" DECIMAL(12,3),
  ADD COLUMN "netUnitPriceTTC" DECIMAL(12,3);

-- Lignes existantes : TTC = HT x (1 + taux) de la ligne, au millime.
UPDATE quote_items qi
SET "unitPriceTTC" = round(qi."unitPriceHT" * (1 + tr."rate" / 100), 3),
    "netUnitPriceTTC" = round(qi."netUnitPrice" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE qi."taxRateId" = tr.id;

UPDATE invoice_items ii
SET "unitPriceTTC" = round(ii."unitPriceHT" * (1 + tr."rate" / 100), 3),
    "netUnitPriceTTC" = round(ii."netUnitPrice" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE ii."taxRateId" = tr.id;

UPDATE credit_note_items ci
SET "unitPriceTTC" = round(ci."unitPriceHT" * (1 + tr."rate" / 100), 3),
    "netUnitPriceTTC" = round(ci."netUnitPrice" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE ci."taxRateId" = tr.id;

UPDATE delivery_note_items di
SET "unitPriceTTC" = round(di."unitPriceHT" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE di."taxRateId" = tr.id;

UPDATE online_order_items oi
SET "unitPriceTTC" = round(oi."unitPriceHT" * (1 + tr."rate" / 100), 3),
    "netUnitPriceTTC" = round(oi."netUnitPrice" * (1 + tr."rate" / 100), 3)
FROM "tax_rates" tr
WHERE oi."taxRateId" = tr.id;