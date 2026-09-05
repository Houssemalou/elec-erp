import type { Role } from '@elec/db'
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Tags,
  Boxes,
  Users,
  Truck,
  FileText,
  Receipt,
  BookMinus,
  PackagePlus,
  Settings,
  ShieldCheck,
  PiggyBank,
  Monitor,
  Landmark,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const ALL_STAFF: Role[] = ['ADMIN', 'MANAGER', 'VENDEUR']
export const MANAGER: Role[] = ['ADMIN', 'MANAGER']
export const ADMIN: Role[] = ['ADMIN']

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ALL_STAFF },
      { href: '/finance', label: 'Finance', icon: PiggyBank, roles: MANAGER },
    ],
  },
  {
    label: 'Ventes',
    items: [
      { href: '/pos', label: 'Caisse (POS)', icon: Monitor, roles: ALL_STAFF },
      { href: '/ventes-caisse', label: 'Ventes en caisse', icon: Landmark, roles: MANAGER },
      { href: '/commandes', label: 'Commandes en ligne', icon: ShoppingBag, roles: ALL_STAFF },
      { href: '/devis', label: 'Devis', icon: FileText, roles: ALL_STAFF },
      { href: '/factures', label: 'Factures', icon: Receipt, roles: ALL_STAFF },
      { href: '/avoirs', label: 'Avoirs', icon: BookMinus, roles: MANAGER },
    ],
  },
  {
    label: 'Catalogue & stock',
    items: [
      { href: '/produits', label: 'Produits', icon: Package, roles: ALL_STAFF },
      { href: '/categories', label: 'Catégories', icon: Tags, roles: MANAGER },
      { href: '/stock', label: 'Stock', icon: Boxes, roles: ALL_STAFF },
      { href: '/achats', label: 'Achats', icon: PackagePlus, roles: MANAGER },
    ],
  },
  {
    label: 'Réseau',
    items: [
      { href: '/clients', label: 'Clients', icon: Users, roles: ALL_STAFF },
      { href: '/fournisseurs', label: 'Fournisseurs', icon: Truck, roles: ALL_STAFF },
    ],
  },
  {
    label: 'Système',
    items: [
      { href: '/parametres', label: 'Paramètres', icon: Settings, roles: ADMIN },
      { href: '/utilisateurs', label: 'Utilisateurs', icon: ShieldCheck, roles: ADMIN },
    ],
  },
]