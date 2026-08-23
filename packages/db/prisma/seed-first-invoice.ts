import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MARGE_VENTE = 1.5

const FACTURE = {
  numero: '89-BT-2026',
  date: new Date('2026-08-20T13:52:34Z'),
  fournisseur: 'AST UNITED TECHNOLOGY - SARL',
  client: {
    firstName: 'HOUSSEM',
    lastName: 'ALOUI',
    cin: '1994856B',
    address: 'OUCHTATA NEFZA BEJA',
  },
  totaux: {
    baseHT: '3273.950',
    tva: '622.050',
    timbre: '1.000',
    netTTC: '3897.000',
  },
}

const CATEGORIES = [
  { name: 'Rails et accessoires projecteur', slug: 'rails-accessoires-projecteur', sortOrder: 1 },
  { name: 'Socles et douilles', slug: 'socles-douilles', sortOrder: 2 },
  { name: 'Profils LED', slug: 'profils-led', sortOrder: 3 },
  { name: 'Guirlandes et rubans LED', slug: 'guirlandes-rubans-led', sortOrder: 4 },
  { name: 'Lampes', slug: 'lampes', sortOrder: 5 },
]

const PRODUITS = [
  { ref: 'F19-2M', name: 'RAIL MAGNETIQUE 2M ENCASTRE', puHT: '54.622', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'F116/RAIL-PJ-1M', name: 'RAIL 1 METRE POUR PROJECTEUR SUR RAIL', puHT: '7.563', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'acs-rail/F122', name: 'MANCHONS/COUDE POUR PROJECTEUR SUR RAIL', puHT: '3.361', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'F21', name: 'TRANSFO MAGNETIQUE 200W', puHT: '42.017', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: '38RSA200BK/F115', name: 'RAIL 2 METRE POUR PROJECTEUR SUR RAIL', puHT: '15.126', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'F31/HS300-1022', name: 'ACCESSOIRE MAGNETIQUE PROJECTEUR ORIENTABLE 12W', puHT: '20.168', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'SJ-108-16', name: 'ACCESSOIRE MAGNETIQUE COB 33 CM 12W 3TON', puHT: '25.210', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'SJ-108-17', name: 'ACCESSOIRE MAGNETIQUE COB 60CM 24W 3TON', puHT: '33.613', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: 'F29', name: 'ACCESSOIRE MAGNETIQUE LINEARE SMD ORIENTABLE 12W 22CM', puHT: '36.975', qte: '1.000', cat: 'rails-accessoires-projecteur', unit: 'piece' },
  { ref: '700RNN', name: 'SOCLE ROND NOIR ORIENTABLE PVC', puHT: '2.059', qte: '100.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: '12206Y/NP-AH192', name: 'SOCLE SPOT PVC FIXE ROND BOMBEE AVEC MOTIF NOIR PEARL', puHT: '2.269', qte: '100.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: '1081Y/NN-AH199', name: 'SOCLE SPOT PVC FIXE ROND A RETRAIT AVEC MOTIF NOIR', puHT: '2.059', qte: '100.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: '1503Y/NN-AH201', name: 'SOCLE SPOT PVC FIXE ROND BOMBEE NOIR', puHT: '2.059', qte: '60.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: 'SPS/2N', name: 'SOCLE PLASTIQUE CARRE DOUBLE ORIENTABLE NOIR', puHT: '6.723', qte: '20.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: '1503/BB-AH201', name: 'SOCLE SPOT PVC FIXE ROND BOMBEE BLANC', puHT: '2.059', qte: '40.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: 'SPS/3N', name: 'SOCLE PLASTIQUE CARRE TRIPLE NOIR', puHT: '8.824', qte: '20.000', cat: 'socles-douilles', unit: 'piece' },
  { ref: 'PL2M-1414N', name: 'PROFILET LED ENCASTRE 2 METRE NOIR Lx22 H14 Li14', puHT: '11.765', qte: '5.000', cat: 'profils-led', unit: 'piece' },
  { ref: '04GLR5/YAS', name: 'GUIRLAND LED SMD TRIPLE 220V 4000K', puHT: '2.227', qte: '100.000', cat: 'guirlandes-rubans-led', unit: 'piece' },
  { ref: 'Sj66-2', name: 'RALLENGE GUIRLAND A DECOPAGE 50CM 220V', puHT: '2.689', qte: '10.000', cat: 'guirlandes-rubans-led', unit: 'piece' },
  { ref: '92012223KA', name: 'RUBAN LED ADHESIF ETANCHE 220V DECOUPAGE 10cm 3000k', puHT: '1.849', qte: '100.000', cat: 'guirlandes-rubans-led', unit: 'piece' },
  { ref: '38LL607/38LL707', name: 'LAMPE 7W GU10 FM/FENIX + douille gu10', puHT: '2.773', qte: '500.000', cat: 'lampes', unit: 'piece' },
]

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function to3(n: string): string {
  return Number(n).toFixed(3)
}

async function main() {
  const force = process.argv.includes('--force')
  console.log('--- Seed premiere facture (89-BT-2026) ---')

  const productCount = await prisma.product.count()
  if (productCount > 0 && !force) {
    console.log(`[SKIP] La table products contient deja ${productCount} produit(s). Rien a faire.`)
    console.log('       Utilise --force pour ecraser les donnees existantes.')
    return
  }

  if (force && productCount > 0) {
    console.log(`[FORCE] Suppression de ${productCount} produit(s) et donnees liees...`)
    await prisma.creditNoteItem.deleteMany({})
    await prisma.creditNote.deleteMany({})
    await prisma.payment.deleteMany({})
    await prisma.invoiceItem.deleteMany({})
    await prisma.invoice.deleteMany({})
    await prisma.purchaseOrderItem.deleteMany({})
    await prisma.purchaseOrder.deleteMany({})
    await prisma.onlineOrderItem.deleteMany({})
    await prisma.onlineOrder.deleteMany({})
    await prisma.quoteItem.deleteMany({})
    await prisma.quote.deleteMany({})
    await prisma.stockMovement.deleteMany({})
    await prisma.stockLevel.deleteMany({})
    await prisma.productImage.deleteMany({})
    await prisma.product.deleteMany({})
    await prisma.category.deleteMany({})
    console.log('  Toutes les donnees supprimees.')
  }

  console.log('Injection des donnees de la facture 89-BT-2026...')

  let tax19 = await prisma.taxRate.findFirst({ where: { rate: '19.00' } })
  if (!tax19) {
    tax19 = await prisma.taxRate.create({ data: { rate: '19.00', label: 'TVA 19%', isDefault: true } })
    console.log('  Taux TVA 19% cree.')
  }

  let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } })
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({ data: { name: 'Magasin principal', code: 'MAG-01', isDefault: true } })
    console.log('  Depot par defaut cree.')
  }

  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!admin) {
    const bcrypt = await import('bcryptjs')
    admin = await prisma.user.create({
      data: {
        email: 'admin@magasin.tn',
        passwordHash: await bcrypt.hash('Admin123!', 10),
        name: 'Administrateur',
        role: 'ADMIN',
      },
    })
    console.log('  Utilisateur admin cree.')
  }

  let supplier = await prisma.supplier.findFirst({ where: { name: FACTURE.fournisseur } })
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { name: FACTURE.fournisseur, active: true },
    })
    console.log('  Fournisseur cree : ' + supplier.name)
  }

  let customer = await prisma.customer.findFirst({ where: { cin: FACTURE.client.cin } })
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        firstName: FACTURE.client.firstName,
        lastName: FACTURE.client.lastName,
        cin: FACTURE.client.cin,
        address: FACTURE.client.address,
        type: 'PROFESSIONNEL',
      },
    })
    console.log('  Client cree : ' + customer.firstName + ' ' + customer.lastName)
  }

  const catMap: Record<string, string> = {}
  for (const c of CATEGORIES) {
    const row = await prisma.category.create({
      data: { name: c.name, slug: c.slug, sortOrder: c.sortOrder, taxRateId: tax19.id },
    })
    catMap[c.slug] = row.id
  }
  console.log(`  ${CATEGORIES.length} categories creees.`)

  const productMap: Record<string, { id: string; costPrice: string; priceHT: string }> = {}
  for (const p of PRODUITS) {
    const costPrice = to3(p.puHT)
    const priceHT = to3((Number(p.puHT) * MARGE_VENTE).toFixed(3))

    const product = await prisma.product.create({
      data: {
        sku: p.ref,
        name: p.name,
        slug: slugify(p.ref + '-' + p.name),
        priceHT,
        costPrice,
        taxRateId: tax19.id,
        categoryId: catMap[p.cat],
        unit: p.unit,
        minStockAlert: '0.000',
      },
    })

    await prisma.stockLevel.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: p.qte,
        reservedQuantity: '0.000',
      },
    })

    await prisma.stockMovement.create({
      data: {
        type: 'PURCHASE_RECEIPT',
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: p.qte,
        reason: 'Reception facture ' + FACTURE.numero,
        reference: FACTURE.numero,
        userId: admin.id,
      },
    })

    productMap[p.ref] = { id: product.id, costPrice, priceHT }
  }
  console.log(`  ${PRODUITS.length} produits crees avec stock initial.`)

  await prisma.sequence.upsert({
    where: { prefix_year: { prefix: 'BON', year: 2026 } },
    update: { lastNumber: 1 },
    create: { prefix: 'BON', year: 2026, lastNumber: 1 },
  })

  const netHT = FACTURE.totaux.baseHT
  const totalTVA = FACTURE.totaux.tva
  const totalTTC = FACTURE.totaux.netTTC

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      number: 'BON-2026-000001',
      supplierId: supplier.id,
      createdById: admin.id,
      status: 'RECEIVED',
      expectedDate: FACTURE.date,
      totalHT: netHT,
      totalTVA,
      totalTTC,
      vatBreakdown: { '19': totalTVA },
      notes: "Facture d'achat initiale - " + FACTURE.numero,
      receivedAt: FACTURE.date,
    },
  })

  for (const p of PRODUITS) {
    await prisma.purchaseOrderItem.create({
      data: {
        purchaseOrderId: purchaseOrder.id,
        productId: productMap[p.ref].id,
        quantity: p.qte,
        unitPriceHT: to3(p.puHT),
        taxRateId: tax19.id,
        receivedQuantity: p.qte,
      },
    })
  }
  console.log(`  Bon de commande ${purchaseOrder.number} cree avec ${PRODUITS.length} lignes.`)
  console.log(`  Total HT: ${netHT} | TVA: ${totalTVA} | TTC: ${totalTTC}`)
  console.log('--- Seed premiere termine ---')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
