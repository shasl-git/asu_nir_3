"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

interface ProductStats {
  name: string;
  deliveredCount: number;
  deliveredAmount: number;
}

interface DailyProductStats {
  name: string;
  deliveredCount: number;
  deliveredAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
  totalCount: number;
  totalAmount: number;
}

interface DailyStats {
  date: string;
  orderedCount: number;
  deliveredCount: number;
  cancelledCount: number;
  inTransitCount: number;
  products: DailyProductStats[];
  orderedAmount: number;
  deliveredAmount: number;
  cancelledAmount: number;
  inTransitAmount: number;
}

interface ProductProfitData {
  productName: string;
  costPrice: number; // Себестоимость за единицу
  logistics: number; // Логистика за единицу
  ozonRewardPercent: number; // Вознаграждение Ozon в %
  taxPercent: number; // НДС в %
  totalProfit: number; // Общая прибыль за период
}

interface OzonReportData {
  ordersCount: number;
  totalAmount: number;
  deliveredCount: number;
  deliveredAmount: number;
  products: ProductStats[];
  periodStart: string;
  periodEnd: string;
  dailyStats: DailyStats[];
}

export default function OzonSalesAnalysis() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState<"fbo" | "fbs" | null>(null);
  const [reportData, setReportData] = useState<OzonReportData | null>(null);
  const [fileName, setFileName] = useState("");
  const [isFormulaExpanded, setIsFormulaExpanded] = useState(false);

  // Состояния для отображения разделов
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [showProfitCalculation, setShowProfitCalculation] = useState(false);

  // Состояние для хранения данных о прибыли для каждого товара
  const [productProfitData, setProductProfitData] = useState<
    ProductProfitData[]
  >([]);

  // Состояния для выбора дат
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // Функция для инициализации данных о прибыли при загрузке отчета
  useEffect(() => {
    if (reportData && reportData.dailyStats.length > 0) {
      // Собираем все уникальные названия товаров из dailyStats
      const allProductNames = new Set<string>();
      reportData.dailyStats.forEach((day) => {
        day.products.forEach((product) => {
          allProductNames.add(product.name);
        });
      });

      // Создаем начальные данные для каждого товара
      const initialProfitData: ProductProfitData[] = Array.from(
        allProductNames,
      ).map((productName) => ({
        productName,
        costPrice: 0,
        logistics: 0,
        ozonRewardPercent: 20, // Значение по умолчанию 20%
        taxPercent: 6, // Значение по умолчанию 6%
        totalProfit: 0,
      }));

      // Обновляем состояние, сохраняя существующие значения для товаров, которые уже были настроены
      setProductProfitData((prev) => {
        const updatedData = [...initialProfitData];
        prev.forEach((existingProduct) => {
          const index = updatedData.findIndex(
            (p) => p.productName === existingProduct.productName,
          );
          if (index !== -1) {
            updatedData[index] = { ...existingProduct, totalProfit: 0 };
          }
        });
        return updatedData;
      });
    }
  }, [reportData]);

  // Функция для расчета прибыли для одного товара в одном дне
  const calculateProfitForProduct = (
    productName: string,
    averagePrice: number,
  ) => {
    const profitData = productProfitData.find(
      (p) => p.productName === productName,
    );

    if (!profitData || averagePrice <= 0) return 0;

    const { costPrice, logistics, ozonRewardPercent, taxPercent } = profitData;

    // Рассчитываем все составляющие
    const ozonRewardAmount = (averagePrice * ozonRewardPercent) / 100;
    const acquiringAmount = averagePrice / 100; // 1% эквайринг
    const taxAmount = (averagePrice * taxPercent) / 100;

    // Расчет прибыли по формуле:
    // Средняя цена - Себестоимость - Логистика - Вознаграждение Ozon - Эквайринг - НДС
    const profit =
      averagePrice -
      costPrice -
      logistics -
      ozonRewardAmount -
      acquiringAmount -
      taxAmount;

    return Math.round(profit * 100) / 100; // Округляем до 2 знаков после запятой
  };

  // Функция для расчета общей прибыли по товару за все дни
  const calculateTotalProfitForProduct = (productName: string) => {
    if (!reportData || !productProfitData.length) return 0;

    let totalProfit = 0;

    reportData.dailyStats.forEach((day) => {
      day.products.forEach((product) => {
        if (product.name === productName && product.deliveredCount > 0) {
          const averagePrice = product.deliveredAmount / product.deliveredCount;
          const profitPerUnit = calculateProfitForProduct(
            productName,
            averagePrice,
          );
          totalProfit += profitPerUnit * product.deliveredCount;
        }
      });
    });

    return Math.round(totalProfit * 100) / 100;
  };

  // Обновляем общую прибыль при изменении данных
  useEffect(() => {
    if (productProfitData.length > 0) {
      const updatedData = productProfitData.map((product) => ({
        ...product,
        totalProfit: calculateTotalProfitForProduct(product.productName),
      }));
      setProductProfitData(updatedData);
    }
  }, [
    reportData,
    productProfitData
      .map(
        (p) =>
          `${p.productName}-${p.costPrice}-${p.logistics}-${p.ozonRewardPercent}-${p.taxPercent}`,
      )
      .join(","),
  ]);

  // НОВАЯ ФУНКЦИЯ: Скачивание отчета через API
  const downloadReportViaApi = async (type: "fbo" | "fbs") => {
    // Проверяем наличие ключей
    const clientId = localStorage.getItem("ozon_client_id");
    const apiKey = localStorage.getItem("ozon_api_key");

    if (!clientId || !apiKey) {
      alert("Сначала настройте API ключи на главной странице Ozon");
      router.push("/ozon");
      return;
    }

    setIsApiLoading(type);

    try {
      // 🔥 ИСПРАВЛЕНИЕ: Формируем даты с правильным временем
      const fromDateTime = new Date(dateFrom);
      fromDateTime.setHours(0, 0, 0, 0); // Начало дня

      const toDateTime = new Date(dateTo);
      toDateTime.setHours(23, 59, 59, 999); // Конец дня (включительно)

      const response = await fetch("/api/ozon/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDate: fromDateTime.toISOString(),
          toDate: toDateTime.toISOString(), // Теперь включает весь последний день
          deliverySchema: type,
          clientId: clientId,
          apiKey: apiKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Ошибка при получении отчета");
      }

      // Получаем файл и парсим его
      const blob = await response.blob();
      const text = await blob.text();

      // Парсим CSV и обновляем данные
      const parsedData = parseOzonCSV(text);
      setReportData(parsedData);
      setFileName(`ozon_${type}_${dateFrom}_${dateTo}.csv`);
    } catch (error: any) {
      console.error("API Error:", error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setIsApiLoading(null);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    try {
      const text = await file.text();
      const parsedData = parseOzonCSV(text);
      setReportData(parsedData);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      alert("Ошибка при обработке файла. Проверьте формат файла.");
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для форматирования даты в единый формат DD.MM.YYYY
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const parseOzonCSV = (csvText: string): OzonReportData => {
    const lines = csvText.split("\n").filter((line) => line.trim() !== "");

    // Пропускаем заголовок и находим индексы колонок
    const headerLine = lines[0];
    const headers = headerLine
      .split(";")
      .map((header) => header.trim().replace(/"/g, ""));

    // Находим индексы нужных колонок
    const quantityIndex = headers.findIndex(
      (header) => header.toLowerCase().includes("количество") || header === "Q",
    );

    const amountIndex = headers.findIndex(
      (header) =>
        header.toLowerCase().includes("оплачено") ||
        header.toLowerCase().includes("цена") ||
        header === "O",
    );

    const statusIndex = headers.findIndex(
      (header) => header.toLowerCase().includes("статус") || header === "E",
    );

    const productNameIndex = headers.findIndex(
      (header) =>
        header.toLowerCase().includes("наименование") ||
        header.toLowerCase().includes("товар") ||
        header === "L",
    );

    const dateIndex = headers.findIndex(
      (header) =>
        header.toLowerCase().includes("принят") ||
        header.toLowerCase().includes("обработк") ||
        header === "C",
    );

    // Если не нашли по названиям, используем индексы (Q=16, O=15, E=4, L=9, C=2 если считать с 0)
    const finalQuantityIndex = quantityIndex !== -1 ? quantityIndex : 16;
    const finalAmountIndex = amountIndex !== -1 ? amountIndex : 15;
    const finalStatusIndex = statusIndex !== -1 ? statusIndex : 4;
    const finalProductNameIndex =
      productNameIndex !== -1 ? productNameIndex : 9;
    const finalDateIndex = dateIndex !== -1 ? dateIndex : 2;

    let ordersCount = 0;
    let totalAmount = 0;
    let deliveredCount = 0;
    let deliveredAmount = 0;

    // Новые переменные для отмененных заказов и заказов в пути
    let cancelledCount = 0;
    let cancelledAmount = 0;
    let inTransitCount = 0;
    let inTransitAmount = 0;

    // Объект для группировки по товарам (общий)
    const productsMap: { [key: string]: ProductStats } = {};

    // Объект для группировки по дням
    const dailyStatsMap: { [key: string]: DailyStats } = {};

    // Объект для детализации по товарам по дням
    const dailyProductsMap: {
      [key: string]: { [productName: string]: DailyProductStats };
    } = {};

    // Массив для хранения всех дат
    const allDates: Date[] = [];

    // Обрабатываем данные, начиная со второй строки
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line
        .split(";")
        .map((value) => value.trim().replace(/"/g, ""));

      if (
        values.length >
        Math.max(
          finalQuantityIndex,
          finalAmountIndex,
          finalStatusIndex,
          finalProductNameIndex,
          finalDateIndex,
        )
      ) {
        const quantity = parseFloat(values[finalQuantityIndex]) || 0;
        const amount = parseFloat(values[finalAmountIndex]) || 0;
        const status = values[finalStatusIndex] || "";
        const productName =
          values[finalProductNameIndex] || "Неизвестный товар";
        const dateTime = values[finalDateIndex] || "";

        // Парсим дату и извлекаем только дату (без времени)
        let dateStr = "";
        let parsedDate: Date | null = null;

        if (dateTime) {
          if (dateTime.includes("-")) {
            // Формат: '2025-11-14 16:00:58'
            parsedDate = new Date(dateTime.replace(" ", "T"));
          } else if (dateTime.includes(".")) {
            // Формат: '06.11.2025 17:09'
            const [datePart, timePart] = dateTime.split(" ");
            const [day, month, year] = datePart.split(".").map(Number);
            if (timePart) {
              const [hours, minutes] = timePart.split(":").map(Number);
              parsedDate = new Date(year, month - 1, day, hours, minutes);
            } else {
              parsedDate = new Date(year, month - 1, day);
            }
          }

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            allDates.push(parsedDate);
            // Форматируем дату в строку DD.MM.YYYY
            dateStr = formatDate(parsedDate);
          }
        }

        // Инициализируем статистику по дню, если еще не инициализирована
        if (dateStr && !dailyStatsMap[dateStr]) {
          dailyStatsMap[dateStr] = {
            date: dateStr,
            orderedCount: 0,
            deliveredCount: 0,
            cancelledCount: 0,
            inTransitCount: 0,
            products: [],
            orderedAmount: 0,
            deliveredAmount: 0,
            cancelledAmount: 0,
            inTransitAmount: 0,
          };
        }

        // Инициализируем карту товаров для дня, если еще не инициализирована
        if (dateStr && !dailyProductsMap[dateStr]) {
          dailyProductsMap[dateStr] = {};
        }

        // Все заказы
        ordersCount += quantity;
        totalAmount += amount;

        // Обновляем общую статистику по дням
        if (dateStr) {
          dailyStatsMap[dateStr].orderedCount += quantity;
          dailyStatsMap[dateStr].orderedAmount += amount;
        }

        // Только доставленные заказы (выкупы)
        const isDelivered = status.toLowerCase().includes("доставлен");
        const isCancelled = status.toLowerCase().includes("отмен");
        const isInTransit = !isDelivered && !isCancelled;

        if (isDelivered) {
          deliveredCount += quantity;
          deliveredAmount += amount;

          if (dateStr) {
            dailyStatsMap[dateStr].deliveredCount += quantity;
            dailyStatsMap[dateStr].deliveredAmount += amount;
          }

          // Добавляем в общую статистику по товарам
          if (!productsMap[productName]) {
            productsMap[productName] = {
              name: productName,
              deliveredCount: 0,
              deliveredAmount: 0,
            };
          }
          productsMap[productName].deliveredCount += quantity;
          productsMap[productName].deliveredAmount += amount;

          // Добавляем в детализацию по товарам для дня
          if (dateStr) {
            if (!dailyProductsMap[dateStr][productName]) {
              dailyProductsMap[dateStr][productName] = {
                name: productName,
                deliveredCount: 0,
                deliveredAmount: 0,
                cancelledCount: 0,
                cancelledAmount: 0,
                totalCount: 0,
                totalAmount: 0,
              };
            }
            dailyProductsMap[dateStr][productName].deliveredCount += quantity;
            dailyProductsMap[dateStr][productName].deliveredAmount += amount;
            dailyProductsMap[dateStr][productName].totalCount += quantity;
            dailyProductsMap[dateStr][productName].totalAmount += amount;
          }
        }

        // Отмененные заказы
        if (isCancelled) {
          cancelledCount += quantity;
          cancelledAmount += amount;

          if (dateStr) {
            dailyStatsMap[dateStr].cancelledCount += quantity;
            dailyStatsMap[dateStr].cancelledAmount += amount;

            // Добавляем в детализацию по товарам для дня
            if (!dailyProductsMap[dateStr][productName]) {
              dailyProductsMap[dateStr][productName] = {
                name: productName,
                deliveredCount: 0,
                deliveredAmount: 0,
                cancelledCount: 0,
                cancelledAmount: 0,
                totalCount: 0,
                totalAmount: 0,
              };
            }
            dailyProductsMap[dateStr][productName].cancelledCount += quantity;
            dailyProductsMap[dateStr][productName].cancelledAmount += amount;
            dailyProductsMap[dateStr][productName].totalCount += quantity;
            dailyProductsMap[dateStr][productName].totalAmount += amount;
          }
        }

        // Заказы в пути
        if (isInTransit) {
          inTransitCount += quantity;
          inTransitAmount += amount;

          if (dateStr) {
            dailyStatsMap[dateStr].inTransitCount += quantity;
            dailyStatsMap[dateStr].inTransitAmount += amount;

            // Для товаров в пути не добавляем в детализацию по товарам
            // так как они еще не имеют финального статуса
          }
        }
      }
    }

    // После обработки всех строк, преобразуем dailyProductsMap в массивы для каждого дня
    for (const dateStr in dailyProductsMap) {
      const productsArray = Object.values(dailyProductsMap[dateStr]);
      dailyStatsMap[dateStr].products = productsArray.sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    // Определяем период отчета
    let periodStart = "";
    let periodEnd = "";

    if (allDates.length > 0) {
      const sortedDates = [...allDates].sort(
        (a, b) => a.getTime() - b.getTime(),
      );
      periodStart = formatDate(sortedDates[0]);
      periodEnd = formatDate(sortedDates[sortedDates.length - 1]);
    }

    // Преобразуем объект в массив и сортируем по дате (от новых к старым)
    const dailyStats = Object.values(dailyStatsMap).sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split(".").map(Number);
      const [dayB, monthB, yearB] = b.date.split(".").map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB.getTime() - dateA.getTime(); // Новые даты первыми
    });

    // Преобразуем объект в массив и сортируем по количеству выкупов (по убыванию)
    const products = Object.values(productsMap)
      .sort((a, b) => b.deliveredCount - a.deliveredCount)
      .filter((product) => product.deliveredCount > 0);

    return {
      ordersCount: Math.round(ordersCount),
      totalAmount: Math.round(totalAmount),
      deliveredCount: Math.round(deliveredCount),
      deliveredAmount: Math.round(deliveredAmount),
      products,
      periodStart,
      periodEnd,
      dailyStats,
    };
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type === "text/csv") {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Обработчики для данных о прибыли
  const handleProfitDataChange = (
    productName: string,
    field: keyof ProductProfitData,
    value: string,
  ) => {
    const numValue = parseFloat(value) || 0;

    setProductProfitData((prev) =>
      prev.map((product) =>
        product.productName === productName
          ? { ...product, [field]: numValue }
          : product,
      ),
    );
  };

  // Расчет дополнительных показателей
  const averageOrderValue =
    reportData && reportData.ordersCount > 0
      ? Math.round(reportData.totalAmount / reportData.ordersCount)
      : 0;

  const averageDeliveredValue =
    reportData && reportData.deliveredCount > 0
      ? Math.round(reportData.deliveredAmount / reportData.deliveredCount)
      : 0;

  const deliveryRate =
    reportData && reportData.ordersCount > 0
      ? Math.round((reportData.deliveredCount / reportData.ordersCount) * 100)
      : 0;

  // Расчет отмененных заказов и заказов в пути из dailyStats
  const cancelledData = reportData
    ? reportData.dailyStats.reduce(
        (acc, day) => ({
          count: acc.count + day.cancelledCount,
          amount: acc.amount + day.cancelledAmount,
        }),
        { count: 0, amount: 0 },
      )
    : { count: 0, amount: 0 };

  const inTransitData = reportData
    ? reportData.dailyStats.reduce(
        (acc, day) => ({
          count: acc.count + day.inTransitCount,
          amount: acc.amount + day.inTransitAmount,
        }),
        { count: 0, amount: 0 },
      )
    : { count: 0, amount: 0 };

  // Расчет общей прибыли за период
  const totalProfitForPeriod = productProfitData.reduce(
    (total, product) => total + product.totalProfit,
    0,
  );

  // Функция для скролла к верху
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  // Функция для скролла к низу
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Навигация */}
        <button
          onClick={() => router.push("/ozon")}
          className="mb-6 text-blue-500 hover:text-blue-700 transition-colors font-semibold"
        >
          ← Назад к Ozon
        </button>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Анализ продаж Ozon
        </h1>
        <p className="text-gray-600 mb-8">
          Загрузите отчет в формате CSV или получите его напрямую через API
        </p>

        {/* НОВЫЙ БЛОК: Получение отчета через API */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 mb-6 border border-blue-200">
          <h2 className="text-xl font-semibold mb-4 text-blue-800 flex items-center">
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Получить отчет через API Ozon
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата с
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-2 border text-gray-700 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => downloadReportViaApi("fbo")}
              disabled={isApiLoading !== null}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isApiLoading === "fbo" ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Загрузка...
                </>
              ) : (
                "📦 Сформировать FBO отчет"
              )}
            </button>
            <button
              onClick={() => downloadReportViaApi("fbs")}
              disabled={isApiLoading !== null}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isApiLoading === "fbs" ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Загрузка...
                </>
              ) : (
                "🚚 Сформировать FBS отчет"
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            * Для работы через API необходимы сохраненные ключи Ozon
          </p>
        </div>
        {/* НОВАЯ КНОПКА ДЛЯ СРАВНЕНИЯ */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/ozon/sales/compare")}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl inline-flex items-center text-lg"
          >
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            📊 Сравнить FBO и FBS поставки
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Сравните эффективность разных схем работы за выбранный период
          </p>
        </div>

        {/* Блок загрузки файла */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-gray-800">
          <h2 className="text-xl font-semibold mb-4">
            Или загрузите готовый отчет
          </h2>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-all hover:border-blue-400 hover:bg-blue-50"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />

            <div className="flex flex-col items-center">
              <svg
                className="w-12 h-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>

              <p className="text-lg font-medium text-gray-700 mb-2">
                Нажмите или перетащите файл для загрузки
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Поддерживается только CSV формат отчетов Ozon
              </p>

              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                Выбрать файл
              </button>
            </div>
          </div>

          {fileName && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700">
                ✅ Файл загружен:{" "}
                <span className="font-semibold">{fileName}</span>
              </p>
            </div>
          )}

          {isLoading && (
            <div className="mt-4 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-gray-600 mt-2">Обработка файла...</p>
            </div>
          )}
        </div>

        {/* Блок с результатами (остается без изменений) */}
        {reportData && (
          <div className="bg-white rounded-lg shadow-md text-gray-800 p-6">
            {/* ... весь остальной код с результатами остается точно таким же ... */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h2 className="text-3xl font-semibold mb-2 md:mb-0">
                Результаты анализа
              </h2>
              {reportData.periodStart && reportData.periodEnd && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <p className="text-blue-700 font-medium text-lg">
                    Период отчета: {reportData.periodStart} -{" "}
                    {reportData.periodEnd}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Количество заказов */}
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Всего заказов
                    </h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {reportData.ordersCount.toLocaleString()} шт
                    </p>
                    <p className="text-lg text-blue-500 mt-1">
                      {reportData.totalAmount.toLocaleString()} ₽
                    </p>
                  </div>
                  <div className="text-blue-500 bg-blue-100 p-3 rounded-full">
                    <svg
                      className="w-8 h-8"
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
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Общее количество заказов за период
                </p>
              </div>

              {/* Количество выкупов */}
              <div className="bg-green-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Выкупленные заказы
                    </h3>
                    <p className="text-3xl font-bold text-green-600">
                      {reportData.deliveredCount.toLocaleString()} шт
                    </p>
                    <p className="text-lg text-green-500 mt-1">
                      {reportData.deliveredAmount.toLocaleString()} ₽
                    </p>
                  </div>
                  <div className="text-green-500 bg-green-100 p-3 rounded-full">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Доставленные и выкупленные товары
                </p>
              </div>

              {/* Отмененные заказы */}
              <div className="bg-red-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Отмененные заказы
                    </h3>
                    <p className="text-3xl font-bold text-red-600">
                      {cancelledData.count.toLocaleString()} шт
                    </p>
                    <p className="text-lg text-red-500 mt-1">
                      {cancelledData.amount.toLocaleString()} ₽
                    </p>
                  </div>
                  <div className="text-red-500 bg-red-100 p-3 rounded-full">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Отмененные заказы за период
                </p>
              </div>

              {/* Заказы в пути */}
              <div className="bg-yellow-50 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      Заказы в пути
                    </h3>
                    <p className="text-3xl font-bold text-yellow-600">
                      {inTransitData.count.toLocaleString()} шт
                    </p>
                    <p className="text-lg text-yellow-500 mt-1">
                      {inTransitData.amount.toLocaleString()} ₽
                    </p>
                  </div>
                  <div className="text-yellow-500 bg-yellow-100 p-3 rounded-full">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Заказы, которые еще доставляются
                </p>
              </div>
            </div>

            {/* Дополнительная статистика */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {averageOrderValue.toLocaleString()} ₽
                </div>
                <div className="text-sm text-gray-600">
                  Средний чек (все заказы)
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {averageDeliveredValue.toLocaleString()} ₽
                </div>
                <div className="text-sm text-gray-600">
                  Средний чек (выкупы)
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {deliveryRate}%
                </div>
                <div className="text-sm text-gray-600">Процент выкупа</div>
              </div>
            </div>

            {/* Статистика по товарам */}
            {reportData.products.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">
                  Статистика по товарам (выкупленные)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-3 text-left">
                          Товар
                        </th>
                        <th className="border border-gray-300 p-3 text-left">
                          Количество выкупов
                        </th>
                        <th className="border border-gray-300 p-3 text-left">
                          Сумма выкупов
                        </th>
                        <th className="border border-gray-300 p-3 text-left">
                          Средний чек
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.products.map((product, index) => (
                        <tr
                          key={index}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="border border-gray-300 p-3 font-medium">
                            {product.name}
                          </td>
                          <td className="border border-gray-300 p-3">
                            {product.deliveredCount.toLocaleString()} шт
                          </td>
                          <td className="border border-gray-300 p-3">
                            {product.deliveredAmount.toLocaleString()} ₽
                          </td>
                          <td className="border border-gray-300 p-3">
                            {Math.round(
                              product.deliveredAmount / product.deliveredCount,
                            ).toLocaleString()}{" "}
                            ₽
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Дополнительная информация */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">
                Сводка по отчету
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Всего заказов:</span>{" "}
                  {reportData.ordersCount.toLocaleString()} шт
                </div>
                <div>
                  <span className="font-medium">Выкупленные заказы:</span>{" "}
                  {reportData.deliveredCount.toLocaleString()} шт
                </div>
                <div>
                  <span className="font-medium">Отмененные заказы:</span>{" "}
                  {cancelledData.count.toLocaleString()} шт
                </div>
                <div>
                  <span className="font-medium">Заказы в пути:</span>{" "}
                  {inTransitData.count.toLocaleString()} шт
                </div>
                <div>
                  <span className="font-medium">Общая сумма:</span>{" "}
                  {reportData.totalAmount.toLocaleString()} ₽
                </div>
                <div>
                  <span className="font-medium">Сумма выкупов:</span>{" "}
                  {reportData.deliveredAmount.toLocaleString()} ₽
                </div>
                <div>
                  <span className="font-medium">Сумма отмен:</span>{" "}
                  {cancelledData.amount.toLocaleString()} ₽
                </div>
                <div>
                  <span className="font-medium">Сумма в пути:</span>{" "}
                  {inTransitData.amount.toLocaleString()} ₽
                </div>
                <div>
                  <span className="font-medium">Процент выкупа:</span>{" "}
                  {deliveryRate}%
                </div>
                {showProfitCalculation && (
                  <div className="md:col-span-2">
                    <span className="font-medium">
                      Общая прибыль за период:
                    </span>{" "}
                    <span className="font-bold text-emerald-600">
                      {totalProfitForPeriod.toFixed(2)} ₽
                    </span>
                  </div>
                )}
                {reportData.periodStart && reportData.periodEnd && (
                  <>
                    <div>
                      <span className="font-medium">Начало периода:</span>{" "}
                      {reportData.periodStart}
                    </div>
                    <div>
                      <span className="font-medium">Конец периода:</span>{" "}
                      {reportData.periodEnd}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Кнопки для показа отчета по дням и расчета прибыли */}
            {reportData.dailyStats.length > 0 && (
              <div className="mt-6 flex flex-col md:flex-row gap-4 justify-center">
                <button
                  onClick={() => setShowDailyReport(!showDailyReport)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg transition-colors font-semibold flex items-center justify-center"
                >
                  {showDailyReport
                    ? "Скрыть отчет по дням"
                    : "Сформировать отчет по дням"}
                  <svg
                    className={`w-5 h-5 ml-2 transition-transform ${
                      showDailyReport ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <button
                  onClick={() =>
                    setShowProfitCalculation(!showProfitCalculation)
                  }
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-3 rounded-lg transition-all duration-300 font-semibold flex items-center justify-center shadow-md hover:shadow-lg"
                >
                  {showProfitCalculation
                    ? "Скрыть расчет прибыли"
                    : "Расчет прибыли"}
                  <svg
                    className={`w-5 h-5 ml-2 transition-transform ${
                      showProfitCalculation ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Раздел "Расчет прибыли" - полностью идентичен твоему */}
            {showProfitCalculation && productProfitData.length > 0 && (
              <div className="mt-6 bg-gradient-to-br from-white to-emerald-50 rounded-xl shadow-lg p-6 border border-emerald-200">
                {/* ... весь твой код для расчета прибыли ... */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-emerald-800">
                      Расчет прибыли по товарам
                    </h3>
                    <p className="text-emerald-600 mt-2">
                      Заполните данные для расчета чистой прибыли по каждому
                      товару за весь период
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-4 py-2">
                      <div className="text-sm text-emerald-700 font-medium">
                        Общая прибыль за период:
                      </div>
                      <div className="text-xl font-bold text-emerald-800">
                        {totalProfitForPeriod.toFixed(2)} ₽
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-emerald-50 to-teal-50">
                          <th className="p-4 text-left font-semibold text-emerald-800 border-b">
                            Товар
                          </th>
                          <th className="p-4 text-left font-semibold text-emerald-800 border-b">
                            Себестоимость
                            <div className="text-xs font-normal text-emerald-600">
                              ₽ за ед.
                            </div>
                          </th>
                          <th className="p-4 text-left font-semibold text-emerald-800 border-b">
                            Логистика Ozon
                            <div className="text-xs font-normal text-emerald-600">
                              ₽ за ед.
                            </div>
                          </th>
                          <th className="p-4 text-left font-semibold text-emerald-800 border-b">
                            Вознаграждение Ozon
                            <div className="text-xs font-normal text-emerald-600">
                              %
                            </div>
                          </th>
                          <th className="p-4 text-left font-semibold text-emerald-800 border-b">
                            НДС
                            <div className="text-xs font-normal text-emerald-600">
                              %
                            </div>
                          </th>
                          <th className="p-4 text-left font-semibold text-emerald-800 border-b bg-emerald-100">
                            Прибыль товара
                            <div className="text-xs font-normal text-emerald-600">
                              за весь период
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {productProfitData.map((product, index) => (
                          <tr
                            key={index}
                            className={`hover:bg-emerald-50 transition-colors ${
                              index % 2 === 0 ? "bg-white" : "bg-emerald-50/30"
                            }`}
                          >
                            <td className="p-4 font-medium text-gray-800 border-b">
                              {product.productName}
                            </td>
                            <td className="p-4 border-b">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={product.costPrice || ""}
                                  onChange={(e) =>
                                    handleProfitDataChange(
                                      product.productName,
                                      "costPrice",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                  placeholder="0.00"
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                  ₽
                                </div>
                              </div>
                            </td>
                            <td className="p-4 border-b">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={product.logistics || ""}
                                  onChange={(e) =>
                                    handleProfitDataChange(
                                      product.productName,
                                      "logistics",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                  placeholder="0.00"
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                  ₽
                                </div>
                              </div>
                            </td>
                            <td className="p-4 border-b">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={product.ozonRewardPercent || ""}
                                  onChange={(e) =>
                                    handleProfitDataChange(
                                      product.productName,
                                      "ozonRewardPercent",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                  placeholder="20"
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                  %
                                </div>
                              </div>
                            </td>
                            <td className="p-4 border-b">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={product.taxPercent || ""}
                                  onChange={(e) =>
                                    handleProfitDataChange(
                                      product.productName,
                                      "taxPercent",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                  placeholder="6"
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                  %
                                </div>
                              </div>
                            </td>
                            <td className="p-4 border-b bg-emerald-50">
                              <div
                                className={`text-center font-bold text-lg px-3 py-2 rounded ${
                                  product.totalProfit > 0
                                    ? "text-emerald-700 bg-emerald-100"
                                    : product.totalProfit < 0
                                      ? "text-red-700 bg-red-100"
                                      : "text-gray-700 bg-gray-100"
                                }`}
                              >
                                {product.totalProfit.toFixed(2)} ₽
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-emerald-800 text-lg flex items-center">
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Формула расчета прибыли на единицу товара:
                    </h4>
                    <button
                      onClick={() => setIsFormulaExpanded(!isFormulaExpanded)}
                      className="text-emerald-600 hover:text-emerald-800 font-medium text-xl flex items-center"
                    >
                      {isFormulaExpanded ? "Свернуть" : "Раскрыть"}
                      <svg
                        className={`w-4 h-4 ml-1 transition-transform ${
                          isFormulaExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {isFormulaExpanded && (
                    <div className="bg-gradient-to-br from-white to-emerald-50 rounded-xl p-5 border border-emerald-200 shadow-sm hover:shadow-md transition-shadow duration-300">
                      {/* ... остальной код формулы ... */}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Отчет по дням */}
            {showDailyReport && reportData.dailyStats.length > 0 && (
              <div className="mt-6 bg-white rounded-lg shadow-md p-6 relative">
                {/* ... весь твой код для отчета по дням ... */}
                <button
                  onClick={() => {
                    const scrollPosition = window.pageYOffset;
                    const windowHeight = window.innerHeight;
                    const documentHeight =
                      document.documentElement.scrollHeight;

                    if (scrollPosition < documentHeight / 2) {
                      scrollToBottom();
                    } else {
                      scrollToTop();
                    }
                  }}
                  className="fixed bottom-8 right-8 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 z-10 group"
                  title="Переключить скролл"
                >
                  <div className="relative w-6 h-6">
                    <svg
                      className="w-6 h-6 transform transition-transform duration-300 group-hover:scale-120"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 8l7-7 7 7"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 16l7 7 7-7"
                      />
                    </svg>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                </button>

                <h3 className="text-2xl font-semibold mb-6 text-center">
                  Отчет по дням
                </h3>

                {reportData.dailyStats.map(
                  (day: DailyStats, dayIndex: number) => (
                    <div key={dayIndex} className="mb-8 last:mb-0">
                      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-t-lg p-4">
                        <h4 className="text-xl font-semibold">
                          Дата: {day.date}
                        </h4>
                      </div>

                      <div className="border border-gray-300 border-t-0 rounded-b-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                            <div className="text-lg font-bold text-blue-600">
                              {day.orderedCount} шт
                            </div>
                            <div className="text-sm text-gray-600">
                              Заказано
                            </div>
                            <div className="text-sm text-blue-500">
                              {day.orderedAmount.toLocaleString()} ₽
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                            <div className="text-lg font-bold text-green-600">
                              {day.deliveredCount} шт
                            </div>
                            <div className="text-sm text-gray-600">
                              Доставлено
                            </div>
                            <div className="text-sm text-green-500">
                              {day.deliveredAmount.toLocaleString()} ₽
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                            <div className="text-lg font-bold text-red-600">
                              {day.cancelledCount} шт
                            </div>
                            <div className="text-sm text-gray-600">
                              Отменено
                            </div>
                            <div className="text-sm text-red-500">
                              {day.cancelledAmount.toLocaleString()} ₽
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
                            <div className="text-lg font-bold text-yellow-600">
                              {day.inTransitCount} шт
                            </div>
                            <div className="text-sm text-gray-600">В пути</div>
                            <div className="text-sm text-yellow-500">
                              {day.inTransitAmount.toLocaleString()} ₽
                            </div>
                          </div>
                        </div>

                        {day.products.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-semibold text-gray-700 mb-3">
                              Детализация по товарам:
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-300">
                                <thead>
                                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                                    <th className="border border-gray-300 p-3 text-left font-semibold">
                                      Товар
                                    </th>
                                    <th className="border border-gray-300 p-3 text-left font-semibold">
                                      Доставлено
                                    </th>
                                    <th className="border border-gray-300 p-3 text-left font-semibold">
                                      Сумма (доставлено)
                                    </th>
                                    <th className="border border-gray-300 p-3 text-left font-semibold">
                                      Отменено
                                    </th>
                                    <th className="border border-gray-300 p-3 text-left font-semibold">
                                      Средняя цена
                                    </th>
                                    {showProfitCalculation && (
                                      <th className="border border-gray-300 p-3 text-left font-semibold bg-gradient-to-r from-emerald-100 to-teal-100">
                                        Прибыль
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.products.map(
                                    (
                                      product: DailyProductStats,
                                      productIndex: number,
                                    ) => {
                                      const averagePrice =
                                        product.deliveredCount > 0
                                          ? product.deliveredAmount /
                                            product.deliveredCount
                                          : 0;
                                      const profitPerUnit =
                                        calculateProfitForProduct(
                                          product.name,
                                          averagePrice,
                                        );
                                      const totalProfit =
                                        profitPerUnit * product.deliveredCount;
                                      const profitColor =
                                        profitPerUnit > 0
                                          ? "text-emerald-700"
                                          : profitPerUnit < 0
                                            ? "text-red-700"
                                            : "text-gray-700";

                                      return (
                                        <tr
                                          key={productIndex}
                                          className={
                                            productIndex % 2 === 0
                                              ? "bg-white"
                                              : "bg-gray-50"
                                          }
                                        >
                                          <td className="border border-gray-300 p-3 font-medium">
                                            {product.name}
                                          </td>
                                          <td className="border border-gray-300 p-3 text-center">
                                            {product.deliveredCount} шт
                                          </td>
                                          <td className="border border-gray-300 p-3 text-center">
                                            {product.deliveredAmount.toLocaleString()}{" "}
                                            ₽
                                          </td>
                                          <td className="border border-gray-300 p-3 text-center">
                                            {product.cancelledCount} шт
                                          </td>
                                          <td className="border border-gray-300 p-3 text-center">
                                            {averagePrice > 0
                                              ? Math.round(
                                                  averagePrice,
                                                ).toLocaleString()
                                              : 0}{" "}
                                            ₽
                                          </td>
                                          {showProfitCalculation && (
                                            <td className="border border-gray-300 p-3 text-center bg-emerald-50">
                                              <div className="flex flex-col items-center">
                                                <div
                                                  className={`font-bold text-lg ${profitColor} mb-1`}
                                                >
                                                  {profitPerUnit.toFixed(2)} ₽
                                                </div>
                                                {product.deliveredCount > 0 && (
                                                  <>
                                                    <div className="text-xs text-gray-500 mb-1">
                                                      за единицу
                                                    </div>
                                                    <div className="text-sm font-semibold text-emerald-800 bg-emerald-100 px-2 py-1 rounded">
                                                      Итого:{" "}
                                                      {totalProfit.toFixed(2)} ₽
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    },
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {showProfitCalculation && (
                          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                            <h5 className="font-semibold text-emerald-800 mb-3 flex items-center">
                              <svg
                                className="w-5 h-5 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                              </svg>
                              Прибыль за день:
                            </h5>
                            <div className="flex justify-center">
                              <div className="bg-white border border-emerald-300 rounded-lg p-4 shadow-sm">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-emerald-700">
                                    {day.products
                                      .reduce((total, product) => {
                                        const averagePrice =
                                          product.deliveredCount > 0
                                            ? product.deliveredAmount /
                                              product.deliveredCount
                                            : 0;
                                        const profitPerUnit =
                                          calculateProfitForProduct(
                                            product.name,
                                            averagePrice,
                                          );
                                        return (
                                          total +
                                          profitPerUnit * product.deliveredCount
                                        );
                                      }, 0)
                                      .toFixed(2)}{" "}
                                    ₽
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    Общая прибыль за {day.date}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <h5 className="font-semibold text-gray-700 mb-2">
                            Процентные показатели:
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-gray-600">
                                  Процент доставки:
                                </span>
                                <span className="text-sm font-medium">
                                  {day.orderedCount > 0
                                    ? Math.round(
                                        (day.deliveredCount /
                                          day.orderedCount) *
                                          100,
                                      )
                                    : 0}
                                  %
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{
                                    width: `${
                                      day.orderedCount > 0
                                        ? (day.deliveredCount /
                                            day.orderedCount) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm text-gray-600">
                                  Процент отмен:
                                </span>
                                <span className="text-sm font-medium">
                                  {day.orderedCount > 0
                                    ? Math.round(
                                        (day.cancelledCount /
                                          day.orderedCount) *
                                          100,
                                      )
                                    : 0}
                                  %
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-red-500 h-2 rounded-full"
                                  style={{
                                    width: `${
                                      day.orderedCount > 0
                                        ? (day.cancelledCount /
                                            day.orderedCount) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                )}

                <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-300">
                  <h5 className="font-semibold text-gray-800 mb-4 text-lg">
                    Сводка по всем дням:
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center bg-white p-4 rounded-lg border border-blue-200">
                      <div className="text-lg font-bold text-blue-600">
                        {reportData.dailyStats
                          .reduce(
                            (sum: number, day: DailyStats) =>
                              sum + day.orderedCount,
                            0,
                          )
                          .toLocaleString()}{" "}
                        шт
                      </div>
                      <div className="text-sm text-gray-600">
                        Всего заказано
                      </div>
                    </div>

                    <div className="text-center bg-white p-4 rounded-lg border border-green-200">
                      <div className="text-lg font-bold text-green-600">
                        {reportData.dailyStats
                          .reduce(
                            (sum: number, day: DailyStats) =>
                              sum + day.deliveredCount,
                            0,
                          )
                          .toLocaleString()}{" "}
                        шт
                      </div>
                      <div className="text-sm text-gray-600">
                        Всего доставлено
                      </div>
                    </div>

                    <div className="text-center bg-white p-4 rounded-lg border border-red-200">
                      <div className="text-lg font-bold text-red-600">
                        {reportData.dailyStats
                          .reduce(
                            (sum: number, day: DailyStats) =>
                              sum + day.cancelledCount,
                            0,
                          )
                          .toLocaleString()}{" "}
                        шт
                      </div>
                      <div className="text-sm text-gray-600">
                        Всего отменено
                      </div>
                    </div>

                    <div className="text-center bg-white p-4 rounded-lg border border-yellow-200">
                      <div className="text-lg font-bold text-yellow-600">
                        {reportData.dailyStats
                          .reduce(
                            (sum: number, day: DailyStats) =>
                              sum + day.inTransitCount,
                            0,
                          )
                          .toLocaleString()}{" "}
                        шт
                      </div>
                      <div className="text-sm text-gray-600">Всего в пути</div>
                    </div>
                  </div>

                  {showProfitCalculation && (
                    <div className="mt-6 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                          <h5 className="font-bold text-emerald-800 text-lg">
                            Общая прибыль за период:
                          </h5>
                          <p className="text-emerald-600 text-sm mt-1">
                            Рассчитана на основе настроек прибыли
                          </p>
                        </div>
                        <div className="mt-4 md:mt-0">
                          <div className="bg-white border-2 border-emerald-400 rounded-lg px-6 py-4 shadow-sm">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-emerald-700">
                                {totalProfitForPeriod.toFixed(2)} ₽
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                Чистая прибыль за весь период
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 text-center">
                    <button
                      onClick={scrollToTop}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-lg transition-all duration-300 font-semibold flex items-center justify-center mx-auto shadow-md hover:shadow-lg"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 10l7-7m0 0l7 7m-7-7v18"
                        />
                      </svg>
                      Вернуться к результатам анализа
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Инструкция */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6 mt-6">
          <h3 className="font-bold text-yellow-800 mb-2 text-2xl">
            Как получить отчет из Ozon?
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-700 text-lg">
            <li>Зайдите в личный кабинет продавца Ozon</li>
            <li>Перейдите в раздел "Аналитика" → "Отчеты"</li>
            <li>Перейдите в раздел "Заказы" → "Заказы со складов Ozon"</li>
            <li>Выберите нужный период и скачайте отчет</li>
            <li>Загрузите файл в форму выше</li>
          </ol>
          <div className="mt-3 text-xs text-yellow-600"></div>
        </div>
      </div>
    </div>
  );
}
