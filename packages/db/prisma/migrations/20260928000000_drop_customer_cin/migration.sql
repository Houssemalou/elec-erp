-- Le CIN n'est plus collecté (ni sur le site, ni dans l'ERP) : la colonne est
-- supprimée. Aucune donnée n'est reprise ailleurs.
-- AlterTable
ALTER TABLE "customers" DROP COLUMN "cin";
