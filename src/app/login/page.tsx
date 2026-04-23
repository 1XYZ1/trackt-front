import { login, signup } from '../actions/auth';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <form className="w-full max-w-sm space-y-4 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
        <h1 className="text-2xl font-bold text-black dark:text-white">Login / Signup</h1>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <input
          name="email"
          type="email"
          placeholder="email"
          required
          className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-black dark:text-white"
        />
        <input
          name="password"
          type="password"
          placeholder="password"
          required
          minLength={6}
          className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-black dark:text-white"
        />
        <div className="flex gap-2">
          <button
            formAction={login}
            className="flex-1 p-2 bg-black dark:bg-white text-white dark:text-black rounded font-medium"
          >
            Login
          </button>
          <button
            formAction={signup}
            className="flex-1 p-2 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white rounded font-medium"
          >
            Signup
          </button>
        </div>
      </form>
    </div>
  );
}
