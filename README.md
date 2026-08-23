# ElecShop — ERP + Boutique en ligne

Monorepo Next.js pour un magasin de produits électriques en Tunisie.
Deux applications partagent la même base PostgreSQL via trois packages communs.

## Architecture

```
apps/
  erp-admin/   # Back-office (ERP) — port 3001 — gestion produits, stock, clients,
               # factures, devis, avoirs, commandes en ligne, notifications temps réel
  vitrine/     # Boutique en ligne — port 3000 — catalogue, panier, commande,
               # espace client, téléchargement des factures PDF
packages/
  db/          # Schéma Prisma, migration, seed
  contracts/   # Logique fiscale (TVA, timbre fiscal) + validation Zod — 14 tests unitaires
  services/    # Logique métier : stock, factures, devis, avoirs, commandes, PDF, mail, notifications
```

## Prérequis

- Node.js ≥ 20
- Docker Desktop (pour la base PostgreSQL et le déploiement)
- npm

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer PostgreSQL (docker)
docker compose up -d db

# 3. Appliquer la migration + seed (données de démonstration)
npm run db:migrate:dev -- -w packages/db -- --name init   # une seule fois
npm run db:seed

# 4. Lancer les deux applications
npm run dev            # ERP sur http://localhost:3001, boutique sur http://localhost:3000
```

### Comptes de démonstration (seed)

| Rôle    | Email               | Mot de passe |
|---------|---------------------|--------------|
| Admin   | admin@magasin.tn    | Admin123!    |
| Manager | manager@magasin.tn  | Manager123!  |
| Vendeur | vendeur@magasin.tn  | Vendeur123!  |
| Client  | client@demo.tn      | Client123!   |

## Règles fiscales tunisiennes

- Remise appliquée **avant** la TVA (`packages/contracts/src/fiscal.ts`, tests dans `tests/fiscal.test.ts`).
- TVA multi-taux (19 %, 13 %, 7 %) par ligne.
- **Timbre fiscal de 1 DT** sur chaque facture (0 sur devis et avoirs).
- Numérotation séquentielle atomique : `FAC-YYYY-######`, `DEV-…`, `AV-…`, `OC-…`, `BON-…`, `TRF-…` (table `Sequence`).

## Gestion du stock

- Réservation du stock pour les commandes en ligne (`reservedQuantity`), décrémentation à la confirmation.
- Journalisation complète des mouvements (`StockMovement`) : réceptions d'achats, ajustements (motif obligatoire), transferts, inventaires.
- Alertes de seuil (`minStockAlert`) → notifications temps réel.

## Notifications temps réel

- Hub SSE sur `/api/events` (mémoire) + sondage base toutes les 3 s (multi-processus).
- Son (Web Audio API) activé après le premier clic ; cloche avec badge et toast.

## Documents (PDF)

- Factures et devis générés en **noir et blanc** via `@react-pdf/renderer` (`packages/services/src/pdf.service.tsx`).
- Routes : `GET /api/pdf/invoice?id=…` et `GET /api/pdf/quote?id=…` (ERP, authentifié).
- Espace client : téléchargement des factures sur `/compte/factures`.

## Déploiement Docker

```bash
docker compose up -d --build          # base + ERP + boutique + nginx (port 80)
```

- `erp.example.tn` → ERP
- `shop.example.tn` → boutique

Adaptez les noms de domaine dans `docker/nginx.conf` et `AUTH_SECRET` dans `docker-compose.yml` (variable `AUTH_SECRET`).

Migration + seed en base docker :

```bash
npm run db:migrate:dev -- -w packages/db -- --name init
npm run db:seed
```

## Scripts utiles

```bash
npm run dev          # ERP + boutique en parallèle
npm run build        # builds de production des deux applications
npm run typecheck    # vérification TypeScript de tout le monorepo
npm run test         # tests unitaires (packages/contracts)
npm run db:studio    # Prisma Studio
```

## Configuration

Les variables d'environnement se trouvent dans `.env` (racine) et doivent être copiées dans
`apps/erp-admin/.env` et `apps/vitrine/.env` :

- `DATABASE_URL` — chaîne PostgreSQL
- `AUTH_SECRET` — secret JWT partagé entre les deux applications
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — premier administrateur
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — envoi d'e-mails (optionnel)
- `SHIPPING_COST` — frais de livraison fixes (optionnel)