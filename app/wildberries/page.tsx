"use client";

import { useRouter } from "next/navigation";

export default function WildberriesPage() {
  const router = useRouter();

  const features = [
    {
      title: "Калькулятор юнит-экономики",
      description: "Расчет прибыльности с учетом специфики WB",
      path: "/wildberries/unit-economics",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      title: "Информация по продажам",
      description: "Анализ продаж и маркетинговых показателей",
      path: "/wildberries/sales",
      color: "bg-pink-500 hover:bg-pink-600",
    },
    {
      title: "Информация по кластерам",
      description: "Кластерный анализ товаров Wildberries",
      path: "/wildberries/clusters",
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Хедер */}
        <div className="text-center mb-12">
          <button
            onClick={() => router.push("/")}
            className="mb-4 text-purple-500 hover:text-purple-700 transition-colors"
          >
            ← Назад на главную
          </button>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Wildberries Analytics
          </h1>
          <p className="text-gray-600">
            Инструменты для анализа и оптимизации бизнеса на Wildberries
          </p>
        </div>

        {/* Кнопки функционала */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <button
              key={index}
              onClick={() => router.push(feature.path)}
              className={`${feature.color} text-white p-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 text-left`}
            >
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm opacity-90">{feature.description}</p>
            </button>
          ))}
        </div>

        {/* Дополнительная информация */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">
            О аналитике Wildberries
          </h2>
          <p className="text-gray-600 mb-4">
            Специализированные инструменты для работы с маркетплейсом
            Wildberries, учитывающие особенности его бизнес-модели и требований.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Учет комиссий и штрафов WB</li>
            <li>Анализ рейтинга продавца</li>
            <li>Мониторинг остатков и поставок</li>
            <li>Анализ промо-акций и скидок</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
