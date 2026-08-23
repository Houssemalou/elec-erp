import { PrismaClient, Role, CustomerType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TAX_RATES = [
  { rate: '19.00', label: 'TVA 19%', isDefault: true },
  { rate: '13.00', label: 'TVA 13%', isDefault: false },
  { rate: '7.00', label: 'TVA 7%', isDefault: false },
]

const CATEGORIES = [
  { name: 'Câbles et fils', slug: 'cables-et-fils', sortOrder: 1 },
  { name: 'Appareillage', slug: 'appareillage', sortOrder: 2 },
  { name: 'Éclairage', slug: 'eclairage', sortOrder: 3 },
  { name: 'Tableaux électriques', slug: 'tableaux-electriques', sortOrder: 4 },
  { name: 'Disjoncteurs et protection', slug: 'disjoncteurs-protection', sortOrder: 5 },
  { name: 'Prises et interrupteurs', slug: 'prises-interrupteurs', sortOrder: 6 },
]

const PRODUCTS: Array<{
  sku: string
  name: string
  brand: string
  category: string
  priceHT: string
  costPrice: string
  tax: string
  minStockAlert: string
  unit: string
  featured?: boolean
}> = [
  { sku: 'CAB-001', name: 'Câble électrique rigide 2.5mm² (rouleau 100m)', brand: 'Tunisie Câbles', category: 'Câbles et fils', priceHT: '89.000', costPrice: '62.000', tax: '19.00', minStockAlert: '20', unit: 'rouleau', featured: true },
  { sku: 'CAB-002', name: 'Câble électrique rigide 1.5mm² (rouleau 100m)', brand: 'Tunisie Câbles', category: 'Câbles et fils', priceHT: '54.000', costPrice: '38.000', tax: '19.00', minStockAlert: '20', unit: 'rouleau' },
  { sku: 'CAB-003', name: 'Fil conducteur 6mm² (rouleau 100m)', brand: 'Tunisie Câbles', category: 'Câbles et fils', priceHT: '165.000', costPrice: '120.000', tax: '19.00', minStockAlert: '10', unit: 'rouleau' },
  { sku: 'DIS-001', name: 'Disjoncteur modulaire 16A 1P', brand: 'Legrand', category: 'Disjoncteurs et protection', priceHT: '14.500', costPrice: '9.800', tax: '19.00', minStockAlert: '50', unit: 'pièce' },
  { sku: 'DIS-002', name: 'Disjoncteur modulaire 32A 2P', brand: 'Legrand', category: 'Disjoncteurs et protection', priceHT: '42.000', costPrice: '29.000', tax: '19.00', minStockAlert: '30', unit: 'pièce' },
  { sku: 'DIS-003', name: 'Interrupteur différentiel 30mA 40A', brand: 'Schneider', category: 'Disjoncteurs et protection', priceHT: '68.000', costPrice: '47.000', tax: '19.00', minStockAlert: '20', unit: 'pièce' },
  { sku: 'TAB-001', name: 'Tableau électrique 12 modules encastrable', brand: 'Hager', category: 'Tableaux électriques', priceHT: '55.000', costPrice: '38.500', tax: '19.00', minStockAlert: '15', unit: 'pièce' },
  { sku: 'TAB-002', name: 'Tableau électrique 24 modules saillant', brand: 'Hager', category: 'Tableaux électriques', priceHT: '89.000', costPrice: '62.000', tax: '19.00', minStockAlert: '10', unit: 'pièce' },
  { sku: 'PRI-001', name: 'Prise de courant 2P+T encastrable', brand: 'Legrand', category: 'Prises et interrupteurs', priceHT: '6.800', costPrice: '4.200', tax: '19.00', minStockAlert: '100', unit: 'pièce' },
  { sku: 'PRI-002', name: 'Interrupteur va-et-vient', brand: 'Legrand', category: 'Prises et interrupteurs', priceHT: '7.500', costPrice: '4.800', tax: '19.00', minStockAlert: '100', unit: 'pièce' },
  { sku: 'LUM-001', name: 'Spot LED encastrable 9W blanc', brand: 'Phillips', category: 'Éclairage', priceHT: '12.000', costPrice: '7.500', tax: '19.00', minStockAlert: '60', unit: 'pièce' },
  { sku: 'LUM-002', name: 'Tubo LED 120cm 18W', brand: 'Phillips', category: 'Éclairage', priceHT: '9.500', costPrice: '6.000', tax: '19.00', minStockAlert: '40', unit: 'pièce' },
  { sku: 'APP-001', name: 'Télérupteur 2 fils 16A', brand: 'Schneider', category: 'Appareillage', priceHT: '24.000', costPrice: '16.500', tax: '19.00', minStockAlert: '25', unit: 'pièce' },
  { sku: 'APP-002', name: 'Minuterie électronique 16A', brand: 'Legrand', category: 'Appareillage', priceHT: '32.000', costPrice: '22.000', tax: '19.00', minStockAlert: '15', unit: 'pièce' },
]

async function main() {
  console.log('🌱 Seed en cours...')

  // --- Taux de TVA ---
  const taxMap: Record<string, string> = {}
  for (const t of TAX_RATES) {
    const existing = await prisma.taxRate.findFirst({ where: { rate: t.rate } })
    const row =
      existing ??
      (await prisma.taxRate.create({
        data: { rate: t.rate, label: t.label, isDefault: t.isDefault },
      }))
    taxMap[t.rate] = row.id
    if (t.isDefault) {
      await prisma.taxRate.update({ where: { id: row.id }, data: { isDefault: true } })
    }
  }

  // --- Dépôt par défaut ---
  const warehouse =
    (await prisma.warehouse.findFirst({ where: { isDefault: true } })) ??
    (await prisma.warehouse.create({
      data: { name: 'Magasin principal', code: 'MAG-01', isDefault: true },
    }))

  // --- Paramètres magasin (singleton) ---
  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {
      storeName: 'ElectroNova',
      slogan: 'Vente de matériel électrique',
      activity: 'Vente de matériel électrique',
      address: 'Ouechtata, Nefza',
      city: 'Béja, 9012',
      phone: '94953261',
      email: 'contact@expert-ele.com',
      matriculeFiscal: '1994856/B',
      legalNotes: '',
      defaultWarehouseId: warehouse.id,
    },
    create: {
      id: 1,
      storeName: 'ElectroNova',
      slogan: 'Vente de matériel électrique',
      activity: 'Vente de matériel électrique',
      address: 'Ouechtata, Nefza',
      city: 'Béja, 9012',
      phone: '94953261',
      email: 'contact@expert-ele.com',
      matriculeFiscal: '1994856/B',
      rib: '',
      legalNotes: '',
      paymentTerms: 'Paiement à la livraison ou par virement bancaire sous 30 jours.',
      defaultWarehouseId: warehouse.id,
    },
  })

  // --- Utilisateurs ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@magasin.tn'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!'
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: 'Administrateur',
      role: Role.ADMIN,
    },
  })
  await prisma.user.upsert({
    where: { email: 'manager@magasin.tn' },
    update: {},
    create: {
      email: 'manager@magasin.tn',
      passwordHash: await bcrypt.hash('Manager123!', 10),
      name: 'Manager',
      role: Role.MANAGER,
    },
  })
  await prisma.user.upsert({
    where: { email: 'vendeur@magasin.tn' },
    update: {},
    create: {
      email: 'vendeur@magasin.tn',
      passwordHash: await bcrypt.hash('Vendeur123!', 10),
      name: 'Vendeur',
      role: Role.VENDEUR,
    },
  })

  // --- Catégories ---
  const catMap: Record<string, string> = {}
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        sortOrder: c.sortOrder,
        taxRateId: taxMap['19.00'],
      },
    })
    catMap[c.name] = row.id
  }

  // --- Produits + stock initial ---
  const admin = await prisma.user.findFirstOrThrow({ where: { email: adminEmail } })
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        slug: p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        brand: p.brand,
        priceHT: p.priceHT,
        costPrice: p.costPrice,
        taxRateId: taxMap[p.tax]!,
        categoryId: catMap[p.category]!,
        minStockAlert: p.minStockAlert,
        unit: p.unit,
        isFeatured: p.featured ?? false,
      },
    })
    await prisma.stockLevel.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: {},
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: '120.000',
        reservedQuantity: 0,
      },
    })
    await prisma.stockMovement.create({
      data: {
        type: 'INVENTORY',
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: '120.000',
        reason: 'Inventaire initial (seed)',
        reference: 'SEED',
        userId: admin.id,
      },
    })
  }

  // --- Client de démonstration ---
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@demo.tn' },
    update: {},
    create: {
      email: 'client@demo.tn',
      passwordHash: await bcrypt.hash('Client123!', 10),
      name: 'Client Démo',
      role: Role.CLIENT,
    },
  })
  await prisma.customer.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: {
      userId: clientUser.id,
      type: CustomerType.PARTICULIER,
      firstName: 'Client',
      lastName: 'Démo',
      email: 'client@demo.tn',
      phone: '+216 20 000 000',
      address: 'Rue de Paris',
      city: 'Tunis',
    },
  })

  // --- Fournisseur de démonstration ---
  const existingSupplier = await prisma.supplier.findFirst({ where: { name: 'Fournisseur Central Électrique' } })
  if (!existingSupplier) {
    await prisma.supplier.create({
      data: {
        name: 'Fournisseur Central Électrique',
        company: 'Central Élec SARL',
        email: 'ventes@central-elec.tn',
        phone: '+216 71 111 111',
        address: 'Zone industrielle',
        city: 'La Soukra',
        matriculeFiscal: '1234567/X/M/000',
      },
    })
  }

  console.log('✅ Seed terminé.')
  console.log(`   Admin : ${adminEmail} / ${adminPassword}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })