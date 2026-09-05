import { PageHeader, Card } from '@/components/ui'

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-24 text-center">
        <span className="text-sm font-medium text-white/50">Module en cours de développement</span>
        <span className="text-xs text-white/40">Ce module sera disponible prochainement.</span>
      </Card>
    </div>
  )
}
