import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link"; // navegación
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trackt",
  description: "Sistema de gestión de equipos y mantenciones",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-zinc-950 text-white">

        {/* Sidebar */}
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-5">
          <h1 className="text-2xl font-bold mb-8">Trackt</h1>

          <nav className="space-y-3 text-zinc-300">
            <Link href="/dashboard" className="block hover:bg-zinc-800 rounded-lg px-3 py-2">
              Dashboard
            </Link>

            <Link href="/equipos" className="block hover:bg-zinc-800 rounded-lg px-3 py-2">
              Equipos
            </Link>

            <Link href="/mantenciones" className="block hover:bg-zinc-800 rounded-lg px-3 py-2">
              Mantenciones
            </Link>
          </nav>
        </aside>

        {/* Contenido */}
        <div className="flex flex-1 flex-col">
          
          {/* Header */}
          <header className="h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6">
            <h2 className="text-lg font-semibold">Trackt</h2>
            <span className="text-sm text-zinc-400">Usuario</span>
          </header>

          {/* Aquí se renderizan las páginas */}
          <main className="flex-1 p-6">
            {children}
          </main>

        </div>

      </body>
    </html>
  );
}