'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export function RevenueChart({ data }: { data: Array<{ month: string; revenue: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFC400" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FFC400" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#999999' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#777777' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toLocaleString('fr-FR')} DT`, 'Chiffre d\'affaires']}
            contentStyle={{ borderRadius: 12, border: '1px solid #2A2A2A', background: '#151515', color: '#FFFFFF', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#FFC400" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
