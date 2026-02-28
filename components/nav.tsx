'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const links = [
  { href: '/', label: 'Översikt' },
  { href: `/month/${new Date().getFullYear()}/${new Date().getMonth() + 1}`, label: 'Månadsvy' },
  { href: '/trends', label: 'Trender' },
  { href: '/budgets', label: 'Budget' },
  { href: '/import', label: 'Importera' },
  { href: '/settings', label: 'Inställningar' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-1">
        <Link href="/" className="font-bold text-indigo-600 dark:text-indigo-400 mr-4 text-lg">
          Kollen
        </Link>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {links.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href.split('/')[1] ? `/${link.href.split('/')[1]}` : link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-2"
        >
          Logga ut
        </button>
      </div>
    </nav>
  );
}
