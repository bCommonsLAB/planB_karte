import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin-Header mit Navigation */}
      <header className="bg-slate-800 text-white py-4 px-6 shadow">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Plan B Karte - Admin</h1>
          <nav>
            <ul className="flex space-x-6">
              <li>
                <Link href="/admin/places" className="hover:text-slate-300">
                  Orte
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-slate-300">
                  Zur Webseite
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Hauptinhalt */}
      <main className="flex-grow bg-slate-50">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-4 px-6">
        <div className="container mx-auto text-center text-sm">
          <p>© {new Date().getFullYear()} Plan B Karte - Adminbereich</p>
        </div>
      </footer>
    </div>
  );
} 