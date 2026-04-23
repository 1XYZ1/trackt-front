import { createClient } from '../lib/supabase/server';
import { logout } from './actions/auth';

interface ApiMe {
  id: string;
  email: string;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  let apiMe: ApiMe | null = null;
  if (session?.access_token) {
    try {
      const res = await fetch(`${apiUrl}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (res.ok) apiMe = await res.json();
    } catch {
      apiMe = null;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center space-y-4 p-6">
        <h1 className="text-4xl font-bold text-black dark:text-white">Trackt</h1>
        {user ? (
          <>
            <p className="text-zinc-600 dark:text-zinc-400">
              Logged in as{' '}
              <b className="text-black dark:text-white">{user.email}</b>
            </p>
            <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded text-left">
              <p className="text-sm text-zinc-500 mb-1">API /me response:</p>
              <pre className="text-xs text-black dark:text-white overflow-x-auto">
                {JSON.stringify(apiMe, null, 2)}
              </pre>
            </div>
            <form action={logout}>
              <button className="p-2 px-4 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white rounded">
                Logout
              </button>
            </form>
          </>
        ) : (
          <a
            href="/login"
            className="inline-block p-2 px-4 bg-black dark:bg-white text-white dark:text-black rounded font-medium"
          >
            Login
          </a>
        )}
      </div>
    </div>
  );
}
