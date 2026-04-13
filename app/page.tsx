import Link from "next/link";
import { getServerSession } from '../lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  // Проверяем авторизацию
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Заголовок */}
        <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
          Аналитика Маркетплейсов
        </h1>

        {/* Описание */}
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Профессиональная платформа для анализа и оптимизации вашего бизнеса на
          маркетплейсах Ozon и Wildberries. Получайте детальную аналитику,
          рассчитывайте юнит-экономику и повышайте эффективность продаж.
        </p>

        <p className="text-md text-gray-500 mb-12">
          Для кого: продавцы, маркетологи, аналитики и владельцы бизнеса на
          маркетплейсах
        </p>

        {/* Кнопки выбора маркетплейса */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Link
            href="/ozon"
            className="bg-blue-500 hover:bg-blue-600 text-white py-4 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center"
          >
            <span className="text-2xl font-semibold">Ozon</span>
            <span className="text-sm opacity-90 mt-1">Аналитика для Ozon</span>
          </Link>

          <Link
            href="/wildberries"
            className="bg-purple-500 hover:bg-purple-600 text-white py-4 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center"
          >
            <span className="text-2xl font-semibold">Wildberries</span>
            <span className="text-sm opacity-90 mt-1">Аналитика для WB</span>
          </Link>
        </div>

        {/* Дополнительная информация */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 text-gray-800 gap-6 text-left">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-2">📊 Юнит-экономика</h3>
            <p className="text-gray-600">
              Расчет прибыльности товаров с учетом всех затрат
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-2">📈 Анализ продаж</h3>
            <p className="text-gray-600">
              Детальная аналитика динамики и трендов продаж
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-2">🔍 Кластерный анализ</h3>
            <p className="text-gray-600">
              Группировка товаров для эффективного управления
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
