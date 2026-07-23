interface SearchBarProps {
  action: string
  placeholder?: string
  defaultValue?: string
  showDateRange?: boolean
  defaultFrom?: string
  defaultTo?: string
  extraParams?: Record<string, string>  // ค่าอื่นที่ต้องคงไว้ตอน submit เช่น status filter เดิม
}

// SearchBar เป็น server component ธรรมดา ใช้ <form method="GET"> ส่งตรงไปที่ URL ของหน้านั้นๆ
// เพื่อให้ search/filter ทำงานได้แม้ JS ปิดอยู่ และ URL แชร์ลิงก์ผลการค้นหาได้
export default function SearchBar({
  action, placeholder = 'ค้นหา...', defaultValue = '',
  showDateRange = false, defaultFrom = '', defaultTo = '',
  extraParams = {},
}: SearchBarProps) {
  return (
    <form method="GET" action={action} className="card" style={{
      padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
    }}>
      {Object.entries(extraParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div style={{ flex: '1 1 220px', minWidth: 180 }}>
        <label className="label">ค้นหา</label>
        <input
          type="text" name="q" defaultValue={defaultValue}
          placeholder={placeholder}
          className="input"
        />
      </div>

      {showDateRange && (
        <>
          <div style={{ flex: '0 1 160px' }}>
            <label className="label">จากวันที่</label>
            <input type="date" name="from" defaultValue={defaultFrom} className="input" />
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label className="label">ถึงวันที่</label>
            <input type="date" name="to" defaultValue={defaultTo} className="input" />
          </div>
        </>
      )}

      <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
        🔍 ค้นหา
      </button>

      {(defaultValue || defaultFrom || defaultTo) && (
        <a href={action} className="btn btn-ghost" style={{ flexShrink: 0 }}>ล้างตัวกรอง</a>
      )}
    </form>
  )
}
