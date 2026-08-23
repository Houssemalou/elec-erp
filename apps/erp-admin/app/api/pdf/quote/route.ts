import { generateQuotePdf } from '@elec/services'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return new Response('id manquant', { status: 400 })
  try {
    const pdf = await generateQuotePdf(id)
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="devis.pdf"',
      },
    })
  } catch (e) {
    return new Response(`Erreur : ${(e as Error).message}`, { status: 500 })
  }
}