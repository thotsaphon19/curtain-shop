'use client'

interface ChangeEntry { old: unknown; new: unknown; label: string }
interface EditLog {
  id: string
  edited_by_name: string
  changes: Record<string, ChangeEntry>
  note?: string
  created_at: string
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(ไม่มีข้อมูล)'
  return String(v)
}

export default function EditHistory({ logs }: { logs: EditLog[] }) {
  if (!logs.length) return null

  return (
    <div className="card" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 }}>
        📝 ประวัติการแก้ไข ({logs.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {logs.map(log => (
          <div key={log.id} style={{
            borderLeft: '3px solid var(--border)', paddingLeft: 12,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)' }}>
                {log.edited_by_name || 'ไม่ระบุ'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(log.created_at).toLocaleString('th-TH', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.entries(log.changes).map(([field, c]) => (
                <div key={field} style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span>:{' '}
                  <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{formatValue(c.old)}</span>
                  {' → '}
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>{formatValue(c.new)}</span>
                </div>
              ))}
            </div>
            {log.note && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                💬 {log.note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
