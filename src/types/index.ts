export type JobStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue'

export interface Customer {
  id: string
  name: string
  phone: string
  address: string
  lat?: number
  lng?: number
  line_user_id?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Technician {
  id: string
  name: string
  phone: string
  line_user_id?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  customer_id: string
  technician_id?: string
  title: string
  description?: string
  address: string
  lat?: number
  lng?: number
  scheduled_date: string
  scheduled_time: string
  status: JobStatus
  start_photo_url?: string
  end_photo_url?: string
  failure_reason?: string
  amount?: number
  bank_account?: string
  qr_code_url?: string
  accepted_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  // joined
  customer?: Customer
  technician?: Technician
}

export interface NotificationLog {
  id: string
  job_id: string
  recipient: 'customer' | 'technician' | 'admin'
  line_user_id?: string
  type: string
  message: string
  sent_at: string
  success: boolean
  error_msg?: string
}

export interface DashboardStats {
  today_total: number
  today_completed: number
  today_pending: number
  today_overdue: number
  week_total: number
  week_completed: number
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

// ── User Management ──────────────────────────────────────
export type UserRole = 'admin' | 'technician' | 'customer' | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface AppUser {
  id: string
  line_user_id?: string
  display_name: string
  phone?: string
  email?: string
  role: UserRole
  status: UserStatus
  avatar_url?: string
  ref_id?: string
  permissions?: Record<string, boolean>
  last_login_at?: string
  notes?: string
  created_at: string
  updated_at: string
  // joined
  invited_by_user?: { display_name: string }
}

export interface UserInvitation {
  id: string
  token: string
  role: UserRole
  expires_at: string
  used_at?: string
  note?: string
  invited_by_user?: { display_name: string }
  used_by_user?: { display_name: string }
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id?: string
  action: string
  target_type?: string
  target_id?: string
  detail?: Record<string, unknown>
  created_at: string
  user?: { display_name: string; avatar_url?: string }
}

// ── Queue ────────────────────────────────────────────────
export interface QueueSlot {
  id: string
  technician_id: string
  slot_date: string
  slot_start: string
  slot_end: string
  job_id?: string
  status: 'available' | 'booked' | 'blocked'
  note?: string
  job?: Job
  technician?: Technician
}

export interface TechnicianSchedule {
  id: string
  technician_id: string
  work_days: number[]
  start_time: string
  end_time: string
  slot_duration: number
  max_jobs_day: number
}
