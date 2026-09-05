'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'

const COLORS = ['#FFC400', '#FFB300', '#E6A200', '#FFD54A', '#FFC400']

export function TopProductsChart({ data }: { data: Array<{ name: string; quantity: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#999999' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
          />
          <YAxis tick={{ fontSize: 11, fill: '#777777' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(v: number) => [`${v} unités`, 'Quantité vendue']}
            contentStyle={{ borderRadius: 12, border: '1px solid #2A2A2A', background: '#151515', color: '#FFFFFF', fontSize: 12 }}
          />
          <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
