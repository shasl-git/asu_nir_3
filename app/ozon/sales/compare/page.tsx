"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProductStats {
  name: string;
  orderedCount: number; // Заказано
  orderedAmount: number; // Сумма заказов
  deliveredCount: number; // Выкуплено
  deliveredAmount: number; // Сумма выкупов
}

interface SchemeData {
  ordersCount: number;
  totalAmount: number;
  deliveredCount: number;
  deliveredAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
  inTransitCount: number;
  inTransitAmount: number;
  deliveryRate: number;
  products: ProductStats[]; // Все товары, а не только топ
}

interface ComparisonData {
  fbo: SchemeData;
  fbs: SchemeData;
  periodStart: string;
  periodEnd: string;
}

export default function OzonComparisonPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(
    null,
  );

  // Состояния для выбора дат
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // Функция для парсинга CSV (возвращает все товары)
  const parseOzonCSV = (csvText: string) => {
    const lines = csvText.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) return null;

    const headers = lines[0].split(";").map((h) => h.trim().replace(/"/g, ""));

    // Находим индексы колонок
    const quantityIndex = headers.findIndex(
      (h) => h.toLowerCase().includes("количество") || h === "Q",
    );
    const amountIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("оплачено") ||
        h.toLowerCase().includes("цена") ||
        h === "O",
    );
    const statusIndex = headers.findIndex(
      (h) => h.toLowerCase().includes("статус") || h === "E",
    );
    const productNameIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("наименование") ||
        h.toLowerCase().includes("товар") ||
        h === "L",
    );

    // Используем найденные индексы или значения по умолчанию
    const finalQuantityIndex = quantityIndex !== -1 ? quantityIndex : 16;
    const finalAmountIndex = amountIndex !== -1 ? amountIndex : 15;
    const finalStatusIndex = statusIndex !== -1 ? statusIndex : 4;
    const finalProductNameIndex =
      productNameIndex !== -1 ? productNameIndex : 9;

    let ordersCount = 0;
    let totalAmount = 0;
    let deliveredCount = 0;
    let deliveredAmount = 0;
    let cancelledCount = 0;
    let cancelledAmount = 0;
    let inTransitCount = 0;
    let inTransitAmount = 0;

    // Мапа для товаров (ключ - название товара)
    const productsMap: { [key: string]: ProductStats } = {};

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(";").map((v) => v.trim().replace(/"/g, ""));

      const quantity = parseFloat(values[finalQuantityIndex]) || 0;
      const amount = parseFloat(values[finalAmountIndex]) || 0;
      const status = values[finalStatusIndex] || "";
      const productName = values[finalProductNameIndex] || "Неизвестный товар";

      ordersCount += quantity;
      totalAmount += amount;

      // Инициализируем товар, если его еще нет
      if (!productsMap[productName]) {
        productsMap[productName] = {
          name: productName,
          orderedCount: 0,
          orderedAmount: 0,
          deliveredCount: 0,
          deliveredAmount: 0,
        };
      }

      // Добавляем в общую статистику товара
      productsMap[productName].orderedCount += quantity;
      productsMap[productName].orderedAmount += amount;

      const isDelivered = status.toLowerCase().includes("доставлен");
      const isCancelled = status.toLowerCase().includes("отмен");

      if (isDelivered) {
        deliveredCount += quantity;
        deliveredAmount += amount;

        // Добавляем в выкупы товара
        productsMap[productName].deliveredCount += quantity;
        productsMap[productName].deliveredAmount += amount;
      } else if (isCancelled) {
        cancelledCount += quantity;
        cancelledAmount += amount;
      } else {
        inTransitCount += quantity;
        inTransitAmount += amount;
      }
    }

    // Преобразуем мапу в массив и сортируем по названию
    const products = Object.values(productsMap).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return {
      ordersCount,
      totalAmount,
      deliveredCount,
      deliveredAmount,
      cancelledCount,
      cancelledAmount,
      inTransitCount,
      inTransitAmount,
      deliveryRate:
        ordersCount > 0 ? Math.round((deliveredCount / ordersCount) * 100) : 0,
      products,
    };
  };

  // Функция для получения одного отчета
  const fetchReport = async (type: "fbo" | "fbs") => {
    const clientId = localStorage.getItem("ozon_client_id");
    const apiKey = localStorage.getItem("ozon_api_key");

    if (!clientId || !apiKey) {
      throw new Error("Ключи API не настроены");
    }

    // Формируем даты с правильным временем
    const fromDateTime = new Date(dateFrom);
    fromDateTime.setHours(0, 0, 0, 0);

    const toDateTime = new Date(dateTo);
    toDateTime.setHours(23, 59, 59, 999);

    const response = await fetch("/api/ozon/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDate: fromDateTime.toISOString(),
        toDate: toDateTime.toISOString(),
        deliverySchema: type,
        clientId,
        apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || `Ошибка при получении ${type.toUpperCase()} отчета`,
      );
    }

    const blob = await response.blob();
    const text = await blob.text();
    return parseOzonCSV(text);
  };

  // Функция сравнения
  const handleCompare = async () => {
    setIsLoading(true);
    setComparisonData(null);

    try {
      // Получаем оба отчета параллельно
      const [fboData, fbsData] = await Promise.all([
        fetchReport("fbo"),
        fetchReport("fbs"),
      ]);

      if (!fboData || !fbsData) {
        throw new Error("Не удалось получить данные отчетов");
      }

      // Форматируем даты для отображения
      const fromDateFormatted = new Date(dateFrom).toLocaleDateString("ru-RU");
      const toDateFormatted = new Date(dateTo).toLocaleDateString("ru-RU");

      setComparisonData({
        fbo: fboData,
        fbs: fbsData,
        periodStart: fromDateFormatted,
        periodEnd: toDateFormatted,
      });
    } catch (error: any) {
      console.error("Comparison Error:", error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Форматирование чисел
  const formatNumber = (num: number) => num.toLocaleString("ru-RU");

  // Получаем все уникальные товары из обоих отчетов для общей таблицы
  const getAllUniqueProducts = () => {
    if (!comparisonData) return [];

    const productSet = new Set<string>();
    comparisonData.fbo.products.forEach((p) => productSet.add(p.name));
    comparisonData.fbs.products.forEach((p) => productSet.add(p.name));

    return Array.from(productSet).sort((a, b) => a.localeCompare(b));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Навигация */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/ozon/sales")}
            className="text-blue-500 hover:text-blue-700 transition-colors font-semibold"
          >
            ← Назад к анализу продаж
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => router.push("/ozon")}
            className="text-blue-500 hover:text-blue-700 transition-colors font-semibold"
          >
            ← К выбору инструментов
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Сравнение FBO и FBS поставок
        </h1>
        <p className="text-gray-600 mb-8">
          Выберите период и сравните эффективность разных схем работы
        </p>

        {/* Блок выбора дат */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата с
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-gray-700 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата по
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-2 text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Получение отчетов...
              </>
            ) : (
              "📊 Сравнить"
            )}
          </button>
        </div>

        {/* Результаты сравнения */}
        {comparisonData && (
          <div className="space-y-6">
            {/* Заголовок с периодом */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <h2 className="text-xl font-semibold text-blue-800">
                Период сравнения: {comparisonData.periodStart} -{" "}
                {comparisonData.periodEnd}
              </h2>
            </div>

            {/* Две колонки с основными показателями */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FBO колонка */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 border border-green-200">
                <div className="flex items-center mb-4">
                  <div className="bg-green-600 text-white p-2 rounded-lg mr-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-green-800">
                    FBO (склад Ozon)
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">Всего заказов</div>
                      <div className="text-xl font-bold text-gray-800">
                        {formatNumber(comparisonData.fbo.ordersCount)} шт
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatNumber(comparisonData.fbo.totalAmount)} ₽
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">Выкуплено</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatNumber(comparisonData.fbo.deliveredCount)} шт
                      </div>
                      <div className="text-sm text-green-500">
                        {formatNumber(comparisonData.fbo.deliveredAmount)} ₽
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">Отменено</div>
                      <div className="text-xl font-bold text-red-600">
                        {formatNumber(comparisonData.fbo.cancelledCount)} шт
                      </div>
                      <div className="text-sm text-red-500">
                        {formatNumber(comparisonData.fbo.cancelledAmount)} ₽
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">В пути</div>
                      <div className="text-xl font-bold text-yellow-600">
                        {formatNumber(comparisonData.fbo.inTransitCount)} шт
                      </div>
                      <div className="text-sm text-yellow-500">
                        {formatNumber(comparisonData.fbo.inTransitAmount)} ₽
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">
                        Процент выкупа
                      </span>
                      <span className="text-2xl font-bold text-green-600">
                        {comparisonData.fbo.deliveryRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${comparisonData.fbo.deliveryRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FBS колонка */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-200">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-600 text-white p-2 rounded-lg mr-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-blue-800">
                    FBS (свой склад)
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">Всего заказов</div>
                      <div className="text-xl font-bold text-gray-800">
                        {formatNumber(comparisonData.fbs.ordersCount)} шт
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatNumber(comparisonData.fbs.totalAmount)} ₽
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">Выкуплено</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatNumber(comparisonData.fbs.deliveredCount)} шт
                      </div>
                      <div className="text-sm text-green-500">
                        {formatNumber(comparisonData.fbs.deliveredAmount)} ₽
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">Отменено</div>
                      <div className="text-xl font-bold text-red-600">
                        {formatNumber(comparisonData.fbs.cancelledCount)} шт
                      </div>
                      <div className="text-sm text-red-500">
                        {formatNumber(comparisonData.fbs.cancelledAmount)} ₽
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-sm text-gray-600">В пути</div>
                      <div className="text-xl font-bold text-yellow-600">
                        {formatNumber(comparisonData.fbs.inTransitCount)} шт
                      </div>
                      <div className="text-sm text-yellow-500">
                        {formatNumber(comparisonData.fbs.inTransitAmount)} ₽
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">
                        Процент выкупа
                      </span>
                      <span className="text-2xl font-bold text-blue-600">
                        {comparisonData.fbs.deliveryRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${comparisonData.fbs.deliveryRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ПОЛНАЯ ТАБЛИЦА ТОВАРОВ */}
            <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Детализация по товарам
              </h3>

              <div className="overflow-x-auto rounded-lg border text-gray-700 border-gray-200">
                <table className="w-full">
                  <thead>
                    {/* Заголовки схем */}
                    <tr>
                      <th className="p-4 text-left bg-gray-50 border-b border-r border-gray-200 w-1/3">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                          Товар
                        </span>
                      </th>
                      <th
                        colSpan={2}
                        className="p-4 text-center bg-gradient-to-r from-green-50 to-emerald-50 border-b border-r border-gray-200"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-semibold text-green-700 uppercase tracking-wider">
                            FBO (склад Ozon)
                          </span>
                        </div>
                      </th>
                      <th
                        colSpan={2}
                        className="p-4 text-center bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm font-semibold text-blue-700 uppercase tracking-wider">
                            FBS (свой склад)
                          </span>
                        </div>
                      </th>
                    </tr>

                    {/* Подзаголовки */}
                    <tr className="bg-gray-50">
                      <th className="p-3 text-left border-b border-r border-gray-200"></th>
                      <th className="p-3 text-left border-b border-r border-gray-200">
                        <div className="text-xs font-medium text-gray-500">
                          Заказано
                        </div>
                      </th>
                      <th className="p-3 text-left border-b border-r border-gray-200">
                        <div className="text-xs font-medium text-gray-500">
                          Выкуплено
                        </div>
                      </th>
                      <th className="p-3 text-left border-b border-r border-gray-200">
                        <div className="text-xs font-medium text-gray-500">
                          Заказано
                        </div>
                      </th>
                      <th className="p-3 text-left border-b border-gray-200">
                        <div className="text-xs font-medium text-gray-500">
                          Выкуплено
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {getAllUniqueProducts().map((productName, idx) => {
                      const fboProduct = comparisonData.fbo.products.find(
                        (p) => p.name === productName,
                      );
                      const fbsProduct = comparisonData.fbs.products.find(
                        (p) => p.name === productName,
                      );

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Название товара */}
                          <td className="p-4 border-r border-gray-200">
                            <div className="font-medium text-gray-800">
                              {productName}
                            </div>
                          </td>

                          {/* FBO Заказано */}
                          <td className="p-4 border-r border-gray-200">
                            {fboProduct ? (
                              <div>
                                <span className="font-semibold text-gray-800">
                                  {fboProduct.orderedCount}
                                </span>
                                <span className="text-gray-500 ml-1">шт</span>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {formatNumber(fboProduct.orderedAmount)} ₽
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          {/* FBO Выкуплено */}
                          <td className="p-4 border-r border-gray-200">
                            {fboProduct && fboProduct.deliveredCount > 0 ? (
                              <div className="bg-green-50 rounded-lg p-1.5 -m-1.5">
                                <span className="font-semibold text-green-600">
                                  {fboProduct.deliveredCount}
                                </span>
                                <span className="text-green-500 ml-1">шт</span>
                                <div className="text-xs text-green-500 mt-0.5">
                                  {formatNumber(fboProduct.deliveredAmount)} ₽
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          {/* FBS Заказано */}
                          <td className="p-4 border-r border-gray-200">
                            {fbsProduct ? (
                              <div>
                                <span className="font-semibold text-gray-800">
                                  {fbsProduct.orderedCount}
                                </span>
                                <span className="text-gray-500 ml-1">шт</span>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {formatNumber(fbsProduct.orderedAmount)} ₽
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          {/* FBS Выкуплено */}
                          <td className="p-4">
                            {fbsProduct && fbsProduct.deliveredCount > 0 ? (
                              <div className="bg-blue-50 rounded-lg p-1.5 -m-1.5">
                                <span className="font-semibold text-blue-600">
                                  {fbsProduct.deliveredCount}
                                </span>
                                <span className="text-blue-500 ml-1">шт</span>
                                <div className="text-xs text-blue-500 mt-0.5">
                                  {formatNumber(fbsProduct.deliveredAmount)} ₽
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Итоговая строка */}
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 font-medium">
                      <td className="p-4 border-t border-r border-gray-200">
                        <span className="font-bold text-gray-700">ИТОГО</span>
                      </td>

                      {/* FBO Итого заказано */}
                      <td className="p-4 border-t border-r border-gray-200">
                        <div>
                          <span className="font-bold text-gray-800">
                            {formatNumber(comparisonData.fbo.ordersCount)}
                          </span>
                          <span className="text-gray-500 ml-1">шт</span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatNumber(comparisonData.fbo.totalAmount)} ₽
                          </div>
                        </div>
                      </td>

                      {/* FBO Итого выкуплено */}
                      <td className="p-4 border-t border-r border-gray-200">
                        <div className="bg-green-50 rounded-lg p-1.5 -m-1.5">
                          <span className="font-bold text-green-600">
                            {formatNumber(comparisonData.fbo.deliveredCount)}
                          </span>
                          <span className="text-green-500 ml-1">шт</span>
                          <div className="text-xs text-green-500 mt-0.5">
                            {formatNumber(comparisonData.fbo.deliveredAmount)} ₽
                          </div>
                        </div>
                      </td>

                      {/* FBS Итого заказано */}
                      <td className="p-4 border-t border-r border-gray-200">
                        <div>
                          <span className="font-bold text-gray-800">
                            {formatNumber(comparisonData.fbs.ordersCount)}
                          </span>
                          <span className="text-gray-500 ml-1">шт</span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatNumber(comparisonData.fbs.totalAmount)} ₽
                          </div>
                        </div>
                      </td>

                      {/* FBS Итого выкуплено */}
                      <td className="p-4 border-t">
                        <div className="bg-blue-50 rounded-lg p-1.5 -m-1.5">
                          <span className="font-bold text-blue-600">
                            {formatNumber(comparisonData.fbs.deliveredCount)}
                          </span>
                          <span className="text-blue-500 ml-1">шт</span>
                          <div className="text-xs text-blue-500 mt-0.5">
                            {formatNumber(comparisonData.fbs.deliveredAmount)} ₽
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
                    <span>Выкупы FBO</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
                    <span>Выкупы FBS</span>
                  </div>
                </div>
                <span>Все товары за выбранный период</span>
              </div>
            </div>

            {/* Кнопка для нового сравнения */}
            <div className="text-center">
              <button
                onClick={() => {
                  setComparisonData(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Новое сравнение
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
