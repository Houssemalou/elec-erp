import nodemailer from 'nodemailer'
import { getStoreSettings } from './helpers'

// ============================================================================
// Emails transactionnels (notification client). Le transport SMTP est lu dans
// l'environnement : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
// Si aucun SMTP n'est configuré, l'envoi est ignoré silencieusement.
// ============================================================================

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  })
  return transporter
}

export interface OrderEmailInput {
  to: string
  orderNumber: string
  status: string
  totalTTC: number
}

export async function sendOrderEmail(input: OrderEmailInput): Promise<boolean> {
  const transport = getTransporter()
  if (!transport) return false
  const settings = await getStoreSettings()
  const from = process.env.MAIL_FROM ?? `"${settings.storeName}" <no-reply@${process.env.SMTP_HOST ?? 'magasin.tn'}>`

  await transport.sendMail({
    from,
    to: input.to,
    subject: `Commande ${input.orderNumber} — ${settings.storeName}`,
    text: [
      `Bonjour,`,
      ``,
      `Votre commande ${input.orderNumber} a été ${input.status}.`,
      `Montant total : ${input.totalTTC.toFixed(3)} DT`,
      ``,
      `Merci de votre confiance,`,
      settings.storeName,
    ].join('\n'),
  })
  return true
}

export { getTransporter }