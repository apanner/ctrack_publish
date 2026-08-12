import { createClient } from '@supabase/supabase-js'

// Vite uses import.meta.env for environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ""
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
})

// Database Types
export interface Profile {
    id: string
    full_name: string
    role: 'admin' | 'artist' | 'production' | 'manager' | 'supervisor'
    department: string | null
    avatar_url: string | null
    is_active: boolean
}

// Database Types (Simplified for now - we can import from ctrack_v0 later)
export type Project = {
    id: string;
    name: string;
    code: string;
}

export type Sequence = {
    id: string;
    code: string;
    project_id: string;
}

export type Shot = {
    id: string;
    code: string;
    sequence_id: string;
    project_id: string;
}
