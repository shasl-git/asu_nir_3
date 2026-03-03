"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function OzonPage() {
  const router = useRouter();
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Загружаем сохраненные ключи при монтировании
  useEffect(() => {
    const savedClientId = localStorage.getItem("ozon_client_id");
    const savedApiKey = localStorage.getItem("ozon_api_key");
    if (savedClientId && savedApiKey) {
      setClientId(savedClientId);
      setApiKey(savedApiKey);
      setIsSaved(true);
    }
  }, []);

  const handleSaveKeys = () => {
    if (!clientId || !apiKey) {
      alert("Заполните оба поля");
      return;
    }
    localStorage.setItem("ozon_client_id", clientId);
    localStorage.setItem("ozon_api_key", apiKey);
    setIsSaved(true);
    setShowApiSettings(false);
    alert("Ключи API сохранены");
  };

  const features = [
    {
      title: "Калькулятор юнит-экономики",
      description: "Расчет прибыльности товаров с учетом всех затрат Ozon",
      path: "/ozon/unit-economics",
      color: "bg-blue-500 hover:bg-blue-600",
      needsApi: true, // Нужны API ключи
    },
    {
      title: "Информация по продажам",
      description: "Детальная аналитика продаж и трендов",
      path: "/ozon/sales",
      color: "bg-green-500 hover:bg-green-600",
      needsApi: true, // Нужны API ключи
    },
    {
      title: "Информация по кластерам",
      description: "Анализ товарных кластеров и категорий",
      path: "/ozon/cluster-analysis",
      color: "bg-orange-500 hover:bg-orange-600",
      needsApi: false, // НЕ нужны API ключи!
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Хедер */}
        <div className="text-center mb-12">
          <button
            onClick={() => router.push("/")}
            className="mb-4 text-blue-500 hover:text-blue-700 transition-colors"
          >
            ← Назад на главную
          </button>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Ozon Analytics
          </h1>
          <p className="text-gray-600">
            Выберите нужный инструмент для анализа вашего бизнеса на Ozon
          </p>

          {/* Кнопка настроек API */}
          <div className="mt-4">
            <button
              onClick={() => setShowApiSettings(!showApiSettings)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isSaved
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-yellow-500 hover:bg-yellow-600 text-white"
              }`}
            >
              {isSaved ? "✓ Ключи API настроены" : "⚙ Настроить API ключи"}
            </button>
          </div>
        </div>

        {/* Модальное окно настроек API */}
        {showApiSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Настройки API Ozon
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium text-gray-700">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full p-2 border rounded text-gray-800"
                    placeholder="3011776"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium text-gray-700">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full p-2 border rounded text-gray-800"
                    placeholder="e25b2c04-..."
                  />
                </div>

                <div className="text-sm text-gray-500">
                  Ключи хранятся только в вашем браузере и не передаются третьим
                  лицам.
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleSaveKeys}
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => setShowApiSettings(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Кнопки функционала */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <button
              key={index}
              onClick={() => {
                // Проверяем только если нужны API ключи
                if (feature.needsApi && !isSaved) {
                  alert("Для этого раздела нужны API ключи");
                  setShowApiSettings(true);
                  return;
                }
                router.push(feature.path);
              }}
              className={`${feature.color} text-white p-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 text-left`}
            >
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm opacity-90">{feature.description}</p>
              {/* Индикатор нужны ли ключи */}
              {feature.needsApi && !isSaved && (
                <div className="mt-2 text-xs bg-white bg-opacity-20 rounded-full px-2 py-1 inline-block">
                  🔑 Требуются API ключи
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Дополнительная информация */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6 text-gray-800">
          <h2 className="text-2xl font-semibold mb-4">О аналитике Ozon</h2>
          <p className="text-gray-600 mb-4">
            Специализированные инструменты для анализа маркетплейса Ozon,
            учитывающие особенности его комиссий, логистики и маркетинговых
            возможностей.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Учет специфических комиссий Ozon</li>
            <li>Анализ программ продвижения Ozon</li>
            <li>Интеграция с логистикой Ozon FBS/FBO</li>
            <li>Мониторинг рейтингов и отзывов</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
