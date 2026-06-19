import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import InventoryActions from './InventoryActions'
export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const { data: items } = await supabaseAdmin.from('inventory_items').select('*, category:inventory_categories(name,icon)').order('name')
  const { data: categories } = await supabaseAdmin.from('inventory_categories').select('*')

  const totalValue = (items||[]).reduce((s,i)=>s+((i.qty||0)*(i.cost_price||0)),0)
  const lowStock = (items||[]).filter(i=>i.qty<=i.min_qty).length

  return (
    <AppLayout user={session}>
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">🪟 คลังสินค้า</h1>
            <p className="page-subtitle">ผ้าม่าน ราง และอุปกรณ์ติดตั้ง</p>
          </div>
          <InventoryActions categories={categories||[]}/>
        </div>

        <div className="stat-grid" style={{marginBottom:20}}>
          {[
            {label:'รายการทั้งหมด',value:items?.length||0,icon:'📦',color:'var(--blue)',bg:'var(--blue-lt)'},
            {label:'ใกล้หมด',value:lowStock,icon:'⚠️',color:'var(--red)',bg:'var(--red-lt)'},
            {label:'มูลค่าคลัง',value:`฿${totalValue.toLocaleString()}`,icon:'💰',color:'var(--amber)',bg:'var(--amber-lt)'},
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <div style={{fontSize:22,background:s.bg,borderRadius:8,padding:'5px 8px',display:'inline-block',marginBottom:8}}>{s.icon}</div>
              <div className="stat-value" style={{color:s.color}}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {lowStock > 0 && (
          <div className="alert alert-warning mb-16">
            <span>⚠️</span>
            <span>มีสินค้า <strong>{lowStock} รายการ</strong> ใกล้หมดสต็อก ควรสั่งเพิ่ม</span>
          </div>
        )}

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>สินค้า</th>
                <th className="hide-mobile">หมวด</th>
                <th>คงเหลือ</th>
                <th className="hide-mobile">ต่ำสุด</th>
                <th className="hide-mobile">ราคาขาย</th>
                <th>สถานะ</th>
              </tr></thead>
              <tbody>
                {(items||[]).map((item,i) => {
                  const isLow=item.qty<=item.min_qty
                  const cat=(item as unknown as {category:{name:string,icon:string}}).category
                  return (
                    <tr key={item.id} style={{background:isLow?(i%2?'#FFF5F5':'#FFF8F8'):undefined}}>
                      <td>
                        <div style={{fontWeight:700,fontSize:13}}>{item.name}</div>
                        {item.sku&&<div className="text-xs text-muted">SKU: {item.sku}</div>}
                      </td>
                      <td className="hide-mobile text-small text-muted">{cat?.icon} {cat?.name}</td>
                      <td>
                        <div style={{fontWeight:800,fontSize:16,color:isLow?'var(--red)':'var(--text)'}}>{item.qty}</div>
                        <div className="text-xs text-muted">{item.unit}</div>
                      </td>
                      <td className="hide-mobile text-small text-muted">{item.min_qty}</td>
                      <td className="hide-mobile text-small">฿{(item.sell_price||0).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${isLow?'badge-red':'badge-green'}`}>{isLow?'⚠️ ใกล้หมด':'✅ ปกติ'}</span>
                      </td>
                    </tr>
                  )
                })}
                {!items?.length&&<tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>ยังไม่มีสินค้า</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
