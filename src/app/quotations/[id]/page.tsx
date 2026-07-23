import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import QuotationForm from '../QuotationForm'
export const dynamic = 'force-dynamic'

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [qtRes, custsRes, jobsRes] = await Promise.all([
    supabaseAdmin.from('quotations')
      .select('*, customer:customers(id,name,phone,address), job:jobs(id,title), quotation_items(*)')
      .eq('id', id).single(),
    supabaseAdmin.from('customers').select('id,name,phone').order('name'),
    supabaseAdmin.from('jobs').select('id,title,customer_id').in('status',['pending','assigned','heading']).order('scheduled_date').limit(50),
  ])

  if (qtRes.error || !qtRes.data) redirect('/quotations')

  return (
    <AppLayout user={session}>
      <QuotationForm
        customers={custsRes.data || []}
        jobs={jobsRes.data || []}
        mode="edit"
        quotation={qtRes.data}
      />
    </AppLayout>
  )
}
