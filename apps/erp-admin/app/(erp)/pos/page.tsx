import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@elec/db'
import { STAFF_ROLES } from '@/lib/session'
import PosTerminal from './pos-terminal'

export const dynamic = 'force-dynamic'

export default async function PosPage() {
  const session = await auth()
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    redirect('/login')
  }

  const [products, customers] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { taxRate: true, category: true, stockLevels: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      where: { active: true },
      orderBy: { firstName: 'asc' },
    }),
  ])

  const productData = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    priceHT: Number(p.priceHT),
    unit: p.unit,
    taxRate: Number(p.taxRate.rate),
    categoryName: p.category?.name ?? null,
    stock: p.stockLevels.reduce((s, l) => s + (Number(l.quantity) - Number(l.reservedQuantity)), 0),
  }))

  const customerData = customers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    companyName: c.companyName,
    email: c.email,
    phone: c.phone,
  }))

  return <PosTerminal products={productData} customers={customerData} />
}
