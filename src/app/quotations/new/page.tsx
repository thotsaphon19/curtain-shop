import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import QuotationForm from '../QuotationForm'
export const dynamic = 'force-dynamic'

export default async function NewQuotationPage() {
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/login')

  const [custsRes, jobsRes] = await Promise.all([
    supabaseAdmin.from('customers').select('id,name,phone').order('name'),
    supabaseAdmin.from('jobs').select('id,title,customer_id').in('status',['pending','assigned','heading']).order('scheduled_date').limit(50),
  ])

  return (
    <AppLayout user={session}>
      <QuotationForm
        customers={custsRes.data || []}
        jobs={jobsRes.data || []}
        mode="new"
      />
    </AppLayout>
  )
}
