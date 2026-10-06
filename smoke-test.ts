import { db, PaymentMethod } from '@elec/db'
import {
  createReceivable,
  registerReceivablePayment,
  getReceivablesOverview,
  saveWeeklyClosing,
  closeWeeklyClosing,
  reopenWeeklyClosing,
  getWeeklyClosingByWeek,
  weeklyGain,
  mondayOf,
} from '@elec/services'

// Copie locale de apps/erp-admin/lib/utils.ts (dateInputValue).
function dateInputValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

async function main() {
  const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) throw new Error('Aucun utilisateur')
  console.log('user:', user.name)

  // --- Créance libre ---------------------------------------------------
  const r = await createReceivable(
    {
      customerName: 'Test Client Créance',
      amountTTC: 300.5,
      dueDate: new Date(2026, 0, 15),
      notes: 'vente comptant non facturée',
    },
    user.id,
  )
  console.log('créance:', r.number, 'status', r.status, 'payé', String(r.paidAmount))

  await registerReceivablePayment({
    receivableId: r.id,
    amount: 100,
    method: PaymentMethod.CASH,
    createdById: user.id,
  })
  let after = await db.receivable.findUniqueOrThrow({ where: { id: r.id } })
  console.log('après 100:', after.status, String(after.paidAmount))

  try {
    await registerReceivablePayment({
      receivableId: r.id,
      amount: 500,
      method: PaymentMethod.CASH,
      createdById: user.id,
    })
    console.log('ERREUR: paiement excessif accepté')
  } catch (e) {
    console.log('paiement excessif refusé:', (e as Error).message)
  }

  await registerReceivablePayment({
    receivableId: r.id,
    amount: 200.5,
    method: PaymentMethod.BANK_TRANSFER,
    reference: 'VIR-1',
    createdById: user.id,
  })
  after = await db.receivable.findUniqueOrThrow({ where: { id: r.id } })
  console.log('après solde:', after.status, String(after.paidAmount))

  try {
    await registerReceivablePayment({
      receivableId: r.id,
      amount: 10,
      method: PaymentMethod.CASH,
      createdById: user.id,
    })
    console.log('ERREUR: paiement sur créance soldée accepté')
  } catch (e) {
    console.log('créance soldée non encaissable:', (e as Error).message)
  }

  const overview = await getReceivablesOverview()
  console.log(
    'overview: factures',
    overview.totals.invoiceCount,
    '| créances',
    overview.totals.receivableCount,
    '| reste',
    overview.totals.remainingTTC,
    '| clients',
    overview.byCustomer.length,
  )

  // --- Clôture hebdomadaire -------------------------------------------
  // 2026-02-04 est un mercredi : la semaine doit remonter au lundi 2026-02-02.
  const ref = new Date(2026, 1, 4, 10, 0, 0)
  console.log('ref =', ref.toDateString())
  console.log('mondayOf(mercredi 04/02):', dateInputValue(mondayOf(ref)))

  const w = await saveWeeklyClosing(
    {
      weekStart: ref,
      revenueTTC: 5000,
      purchasesTTC: 2000,
      expensesTTC: 500,
      otherExpensesTTC: 100,
      notes: 'semaine de test',
    },
    user.id,
  )
  console.log('clôture:', w.number, w.weekStart.toISOString().slice(0, 10), '→', w.weekEnd.toISOString().slice(0, 10))
  console.log('gain:', weeklyGain({ revenueTTC: 5000, purchasesTTC: 2000, expensesTTC: 500, otherExpensesTTC: 100 }))

  // Le même jour de la semaine doit retomber sur la même clôture (upsert).
  const same = await saveWeeklyClosing(
    { weekStart: mondayOf(ref), revenueTTC: 5200, purchasesTTC: 2000, expensesTTC: 500, otherExpensesTTC: 100 },
    user.id,
  )
  console.log('upsert même semaine:', same.id === w.id, 'CA', String(same.revenueTTC))

  await closeWeeklyClosing(w.id)
  const closed = await getWeeklyClosingByWeek(ref)
  console.log('clôturée:', !!closed?.closedAt)

  try {
    await saveWeeklyClosing({ weekStart: ref, revenueTTC: 1, purchasesTTC: 0, expensesTTC: 0, otherExpensesTTC: 0 }, user.id)
    console.log('ERREUR: modification dune semaine clôturée acceptée')
  } catch (e) {
    console.log('semaine clôturée verrouillée:', (e as Error).message)
  }

  await reopenWeeklyClosing(w.id)
  const reopened = await getWeeklyClosingByWeek(ref)
  console.log('rouverte:', reopened?.closedAt === null)

  // Semaine en perte
  const loss = await saveWeeklyClosing(
    { weekStart: new Date('2026-01-05'), revenueTTC: 100, purchasesTTC: 400, expensesTTC: 50, otherExpensesTTC: 0 },
    user.id,
  )
  console.log('semaine en perte, gain:', weeklyGain({ revenueTTC: 100, purchasesTTC: 400, expensesTTC: 50, otherExpensesTTC: 0 }), loss.number)

  // Nettoyage
  await db.weeklyClosing.deleteMany({ where: { number: { in: [w.number, loss.number] } } })
  await db.receivable.delete({ where: { id: r.id } })
  console.log('nettoyage ok')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAIL:', e)
    process.exit(1)
  })