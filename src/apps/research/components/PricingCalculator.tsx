import { useState } from 'react'
import { computeCombos, formatMyr, formatVnd } from '../services/pricing'
import {
  EXCHANGE_RATE_VND_PER_MYR, DEFAULT_TOTAL_FEE_PCT, DEFAULT_OPS_PCT,
  DEFAULT_AFFILIATE_PCT, DEFAULT_PROFIT_PCT,
} from '../constants'

export default function PricingCalculator({ defaultPriceMyr }: { defaultPriceMyr: number }) {
  const [capitalVnd, setCapitalVnd] = useState(50000)
  const [priceMyr, setPriceMyr] = useState(defaultPriceMyr || 39)
  const [profitPct, setProfitPct] = useState(DEFAULT_PROFIT_PCT)

  const combos = computeCombos({
    capitalVnd,
    sellingPriceMyr: priceMyr,
    feeRatePct: DEFAULT_TOTAL_FEE_PCT,
    affiliateRatePct: DEFAULT_AFFILIATE_PCT,
    opsRatePct: DEFAULT_OPS_PCT,
    profitTargetPct: profitPct,
    exchangeRate: EXCHANGE_RATE_VND_PER_MYR,
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Vốn nhập (VND/sp)
          <input
            type="number" value={capitalVnd} onChange={(e) => setCapitalVnd(Number(e.target.value) || 0)}
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm font-semibold text-blue-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Giá bán 1 sp (RM)
          <input
            type="number" value={priceMyr} onChange={(e) => setPriceMyr(Number(e.target.value) || 0)}
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm font-semibold text-blue-600"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Lợi nhuận mong muốn: <span className="font-bold text-slate-800">{Math.round(profitPct * 100)}%</span>
        <input
          type="range" min={0.1} max={0.2} step={0.01} value={profitPct}
          onChange={(e) => setProfitPct(Number(e.target.value))}
          className="accent-emerald-500"
        />
      </label>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        Phí sàn {Math.round(DEFAULT_TOTAL_FEE_PCT * 100)}% · Affiliate {Math.round(DEFAULT_AFFILIATE_PCT * 100)}% · Vận hành 15% · Tỷ giá {EXCHANGE_RATE_VND_PER_MYR.toLocaleString('vi-VN')}đ
      </p>

      {/* Bảng combo */}
      <div className="overflow-hidden rounded-xl border border-black/10">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Khoản</th>
              <th className="px-2 py-2 text-right font-semibold">1 sp</th>
              <th className="px-2 py-2 text-right font-semibold">Combo 2</th>
              <th className="px-2 py-2 text-right font-semibold">Combo 3</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            <Row label="Giá bán" cells={combos.map((c) => formatMyr(c.revenueMyr))} />
            <Row label="Vốn hàng" muted cells={combos.map((c) => formatMyr(c.capitalMyr))} />
            <Row label="Phí sàn" muted cells={combos.map((c) => formatMyr(c.feeMyr))} />
            <Row label="Hoa hồng aff" muted cells={combos.map((c) => formatMyr(c.affiliateMyr))} />
            <Row label="Vận hành 15%" muted cells={combos.map((c) => formatMyr(c.opsMyr))} />
            <Row label="Lợi nhuận" cells={combos.map((c) => formatMyr(c.profitMyr))} bold />
            <tr className="bg-emerald-50">
              <td className="px-3 py-2 font-bold text-emerald-800">→ CPA tối đa/đơn</td>
              {combos.map((c) => (
                <td key={c.n} className="px-2 py-2 text-right font-bold text-emerald-700">
                  {c.ok ? formatVnd(c.cpaMaxVnd) : '—'}
                </td>
              ))}
            </tr>
            <Row label="Lợi nhuận/đơn (VND)" cells={combos.map((c) => formatVnd(c.profitVnd))} bold />
            <tr>
              <td className="px-3 py-2 font-semibold text-slate-500">Trạng thái</td>
              {combos.map((c) => (
                <td key={c.n} className={`px-2 py-2 text-right font-bold ${c.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.ok ? 'OK' : 'Lỗ'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        💡 Combo càng nhiều, CPA tối đa/đơn càng cao + lợi nhuận/đơn càng lớn → nên đẩy combo.
      </p>
    </div>
  )
}

function Row({ label, cells, muted, bold }: { label: string; cells: string[]; muted?: boolean; bold?: boolean }) {
  return (
    <tr>
      <td className={`px-3 py-1.5 ${muted ? 'text-slate-400' : 'text-slate-600'} ${bold ? 'font-bold text-slate-800' : ''}`}>{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`px-2 py-1.5 text-right ${muted ? 'text-slate-400' : 'text-slate-700'} ${bold ? 'font-bold text-slate-900' : ''}`}>{c}</td>
      ))}
    </tr>
  )
}
