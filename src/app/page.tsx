import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const dest = { admin:'/dashboard', technician:'/technician', customer:'/customer-portal' }[session.role] || '/login'
  redirect(dest)
}
