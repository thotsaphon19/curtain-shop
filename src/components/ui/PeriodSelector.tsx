// Helper: คำนวณ from/to จาก period
import { getBangkokMidnight } from '@/lib/date'

export function getPeriodDates(period: string, customFrom?: string, customTo?: string) {
  const now = getBangkokMidnight()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

  switch (period) {
    case 'today': {
      const t = fmt(now)
      return { from: t, to: t, label: 'วันนี้' }
    }
    case 'week': {
      const day = now.getDay() || 7
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { from: fmt(mon), to: fmt(sun), label: 'สัปดาห์นี้' }
    }
    case 'month': {
      const from = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0)
      return { from, to: fmt(last), label: `${now.toLocaleDateString('th-TH',{month:'long',year:'numeric'})}` }
    }
    case 'year': {
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31`, label: `ปี ${now.getFullYear()+543}` }
    }
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth()-1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(d), to: fmt(last), label: 'เดือนที่แล้ว' }
    }
    case 'last_week': {
      const day = now.getDay() || 7
      const mon = new Date(now); mon.setDate(now.getDate() - day - 6)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { from: fmt(mon), to: fmt(sun), label: 'สัปดาห์ที่แล้ว' }
    }
    default:
      return { from: customFrom || fmt(now), to: customTo || fmt(now), label: 'กำหนดเอง' }
  }
}

// Period Selector component (server-rendered form GET)
interface PeriodSelectorProps {
  action: string
  currentPeriod: string
  currentFrom: string
  currentTo: string
  extraParams?: Record<string, string>
  showSearch?: boolean
  searchValue?: string
}

export default function PeriodSelector({
  action, currentPeriod, currentFrom, currentTo,
  extraParams = {}, showSearch = false, searchValue = '',
}: PeriodSelectorProps) {
  const periods = [
    { key: 'today',      label: 'วันนี้' },
    { key: 'week',       label: 'สัปดาห์นี้' },
    { key: 'last_week',  label: 'สัปดาห์ที่แล้ว' },
    { key: 'month',      label: 'เดือนนี้' },
    { key: 'last_month', label: 'เดือนที่แล้ว' },
    { key: 'year',       label: 'ปีนี้' },
    { key: 'custom',     label: 'กำหนดเอง' },
  ]

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      {/* Quick buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {periods.map(p => (
          <a key={p.key}
            href={`${action}?period=${p.key}${Object.entries(extraParams).map(([k,v])=>`&${k}=${v}`).join('')}${showSearch&&searchValue?`&q=${searchValue}`:''}`}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', textDecoration: 'none',
              background: currentPeriod === p.key ? 'var(--dark)' : 'var(--white)',
              color: currentPeriod === p.key ? '#fff' : 'var(--text-muted)',
              boxShadow: 'var(--shadow-sm)',
              border: currentPeriod === p.key ? 'none' : '1px solid var(--border)',
            }}>
            {p.label}
          </a>
        ))}
      </div>

      {/* Custom date range + search */}
      <form method="GET" action={action} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input type="hidden" name="period" value="custom" />
        {Object.entries(extraParams).map(([k,v]) => <input key={k} type="hidden" name={k} value={v} />)}

        {showSearch && (
          <div style={{ flex: '2 1 200px' }}>
            <label className="label">ค้นหา</label>
            <input type="text" name="q" defaultValue={searchValue} placeholder="ค้นหา..." className="input" />
          </div>
        )}
        <div style={{ flex: '0 1 150px' }}>
          <label className="label">จากวันที่</label>
          <input type="date" name="from" defaultValue={currentFrom} className="input" />
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label className="label">ถึงวันที่</label>
          <input type="date" name="to" defaultValue={currentTo} className="input" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>🔍 ค้นหา</button>
      </form>

      {/* Show current range */}
      {currentPeriod && currentPeriod !== 'custom' && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          📅 {currentFrom} ถึง {currentTo}
        </div>
      )}
    </div>
  )
}
