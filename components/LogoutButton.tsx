'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-lg hover:shadow-xl hover:bg-red-50 hover:border-red-200 transition-all duration-200 group"
      aria-label="Выйти из аккаунта"
    >
      <span className="text-lg sm:text-xl group-hover:scale-110 transition-transform">🚪</span>
      <span className="text-sm sm:text-base font-medium text-gray-700 group-hover:text-red-600 transition-colors">
        Выйти
      </span>
    </button>
  );
}