import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function apiGet<T>(path: string, auth = false): Promise<T | null> {
  try {
    const headers = auth ? await authHeaders() : {};
    const res = await fetch(`${API_URL}${path}`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface ApiHealth {
  message: string;
}

export interface ApiMe {
  id: string;
  email: string;
}

export interface DbMessage {
  id: number;
  text: string;
  created_at: string;
}
