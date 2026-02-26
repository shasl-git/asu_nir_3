"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// Тип для результатов расчета логистики
type LogisticsCalculation = {
  liters: string;
  index: number;
  cost: string;
  withReception: string;
  total: string;
};

export default function OzonUnitEconomics() {
  const router = useRouter();

  // Состояния для курсов валют
  const [exchangeRates, setExchangeRates] = useState({
    usd: 0,
    cny: 0,
  });

  // Состояния для конвертации валют
  const [currencyConversion, setCurrencyConversion] = useState({
    usdAmount: 0,
    cnyAmount: 0,
  });

  // Состояния для себестоимости
  const [costData, setCostData] = useState({
    purchaseCost: 0,
    quantity: 0,
    chinaShipping: 0,
    russiaShipping: 0,
    fulfillment: 0,
    additionalCosts: 0,
  });

  // Состояния для расчета маржинальности
  const [marginData, setMarginData] = useState({
    sellingPrice: 0,
    ozonRewardPercent: 0,
    taxPercent: 0,
  });

  // Состояния для калькулятора логистики
  const [logisticsData, setLogisticsData] = useState({
    width: 0,
    length: 0,
    height: 0,
  });

  // Валидация полей
  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});

  // Расчеты
  const usdInRubles = currencyConversion.usdAmount * exchangeRates.usd;
  const cnyInRubles = currencyConversion.cnyAmount * exchangeRates.cny;

  // Расчет себестоимости
  const totalAdditionalCosts =
    costData.chinaShipping +
    costData.russiaShipping +
    costData.fulfillment +
    costData.additionalCosts;
  const totalCost =
    costData.purchaseCost * costData.quantity + totalAdditionalCosts;
  const costPerItem = costData.quantity > 0 ? totalCost / costData.quantity : 0;

  // Расчет логистики на основе литража
  const calculateLogistics = (): LogisticsCalculation | null => {
    if (
      logisticsData.width <= 0 ||
      logisticsData.length <= 0 ||
      logisticsData.height <= 0
    ) {
      return null;
    }

    // Вычисляем литраж (объем в литрах)
    const liters =
      (logisticsData.width * logisticsData.length * logisticsData.height) /
      1000;

    // Определяем индекс по литражу

    let index;
    if (liters <= 0.2) {
      index = 50;
    } else if (liters <= 0.4) {
      index = 55;
    } else if (liters <= 0.6) {
      index = 58;
    } else if (liters <= 0.8) {
      index = 61;
    } else if (liters <= 1) {
      index = 63;
    } else if (liters <= 1.25) {
      index = 71;
    } else if (liters <= 1.5) {
      index = 74;
    } else if (liters <= 1.75) {
      index = 77;
    } else if (liters <= 2) {
      index = 81;
    } else if (liters <= 3) {
      index = 81;
    } else if (liters <= 4) {
      index = 87;
    } else if (liters <= 5) {
      index = 99;
    } else if (liters <= 6) {
      index = 99;
    } else if (liters <= 7) {
      index = 112;
    } else if (liters <= 8) {
      index = 122;
    } else if (liters <= 9) {
      index = 122;
    } else if (liters <= 10) {
      index = 122;
    } else if (liters <= 11) {
      index = 128;
    } else if (liters <= 12) {
      index = 128;
    } else if (liters <= 13) {
      index = 136;
    } else if (liters <= 14) {
      index = 136;
    } else if (liters <= 15) {
      index = 170;
    } else if (liters <= 17) {
      index = 182;
    } else if (liters <= 20) {
      index = 182;
    } else if (liters <= 25) {
      index = 210;
    } else {
      index = 210;
    }

    // Расчет стоимости логистики
    const logisticsCost = liters * index;
    const logisticsWithReception = logisticsCost + 25; // +25 рублей за приемку
    const totalLogistics = logisticsWithReception * 1.1; // +10%

    return {
      liters: liters.toFixed(2),
      index,
      cost: logisticsCost.toFixed(2),
      withReception: logisticsWithReception.toFixed(2),
      total: totalLogistics.toFixed(2),
    };
  };

  const logisticsCalculation = calculateLogistics();
  const logisticsCost = logisticsCalculation
    ? parseFloat(logisticsCalculation.total)
    : 0;

  // Расчет эквайринга (1% от цены продажи)
  const acquiringAmount = marginData.sellingPrice * 0.01;

  // Расчет маржинальности (обновлено)
  const ozonRewardAmount =
    (marginData.sellingPrice * marginData.ozonRewardPercent) / 100;
  const totalExpenses = ozonRewardAmount + acquiringAmount + logisticsCost;
  const taxAmount = (marginData.sellingPrice * marginData.taxPercent) / 100;
  const fullCost = costPerItem + totalExpenses + taxAmount;
  const margin = marginData.sellingPrice - fullCost;
  const marginPercent =
    marginData.sellingPrice > 0 ? (margin / marginData.sellingPrice) * 100 : 0;
  const profitabilityPercent = fullCost > 0 ? (margin / fullCost) * 100 : 0;

  // Валидация формы
  const validateField = (field: string, value: number) => {
    if (isNaN(value) || value < 0) {
      setValidationErrors((prev) => ({ ...prev, [field]: true }));
      return false;
    } else {
      setValidationErrors((prev) => ({ ...prev, [field]: false }));
      return true;
    }
  };

  const handleExchangeRateChange = (currency: "usd" | "cny", value: string) => {
    const numValue = parseFloat(value) || 0;
    setExchangeRates((prev) => ({ ...prev, [currency]: numValue }));
    validateField(`${currency}Rate`, numValue);
  };

  const handleCurrencyConversionChange = (
    currency: "usdAmount" | "cnyAmount",
    value: string,
  ) => {
    const numValue = parseFloat(value) || 0;
    setCurrencyConversion((prev) => ({ ...prev, [currency]: numValue }));
    validateField(currency, numValue);
  };

  const handleCostDataChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCostData((prev) => ({ ...prev, [field]: numValue }));
    validateField(field, numValue);
  };

  const handleMarginDataChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMarginData((prev) => ({ ...prev, [field]: numValue }));
    validateField(field, numValue);
  };

  const handleLogisticsDataChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLogisticsData((prev) => ({ ...prev, [field]: numValue }));
    validateField(field, numValue);
  };

  // Автоподстановка примерных курсов при загрузке
  useEffect(() => {
    // Примерные курсы (можно заменить на актуальные через API)
    setExchangeRates({
      usd: 92.5,
      cny: 12.8,
    });
  }, []);

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
          Калькулятор юнит-экономики Ozon
        </h1>
        <p className="text-gray-600 mb-8">
          Расчет прибыльности товаров с учетом всех затрат
        </p>

        {/* Блок курсов валют */}
        <div className="bg-white rounded-lg text-gray-700 shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Курсы валют к рублю</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Валюта
              </label>
              <div className="text-center font-medium">Доллары (USD)</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Юани (CNY)
              </label>
              <div className="text-center font-medium">Юани (CNY)</div>
            </div>
            <div className="hidden md:block"></div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Курс к рублю
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={exchangeRates.usd || ""}
                onChange={(e) =>
                  handleExchangeRateChange("usd", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.usdRate
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Например: 92.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Курс к рублю
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={exchangeRates.cny || ""}
                onChange={(e) =>
                  handleExchangeRateChange("cny", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.cnyRate
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Например: 12.8"
              />
            </div>
          </div>
        </div>

        {/* Конвертер валют */}
        <div className="bg-white rounded-lg text-gray-700 shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Конвертер валют в рубли
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Валюта
              </label>
              <div className="text-center font-medium">Доллары (USD)</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Юани (CNY)
              </label>
              <div className="text-center font-medium">Юани (CNY)</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                В рублях
              </label>
              <div className="text-center font-medium">Рубли (RUB)</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество
              </label>
              <input
                type="number"
                step="0.01"
                value={currencyConversion.usdAmount || ""}
                onChange={(e) =>
                  handleCurrencyConversionChange("usdAmount", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.usdAmount
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество
              </label>
              <input
                type="number"
                step="0.01"
                value={currencyConversion.cnyAmount || ""}
                onChange={(e) =>
                  handleCurrencyConversionChange("cnyAmount", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.cnyAmount
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div className="flex items-end">
              <div className="w-full text-center py-2 bg-gray-100 rounded-lg font-semibold">
                {usdInRubles + cnyInRubles} ₽
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>USD в RUB: {usdInRubles} ₽</div>
            <div>CNY в RUB: {cnyInRubles} ₽</div>
          </div>
        </div>

        {/* Расчет себестоимости */}
        <div className="bg-white rounded-lg text-gray-700 shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Расчет себестоимости</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Закупочная стоимость (за единицу, ₽)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={costData.purchaseCost || ""}
                onChange={(e) =>
                  handleCostDataChange("purchaseCost", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.purchaseCost
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество штук
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                value={costData.quantity || ""}
                onChange={(e) =>
                  handleCostDataChange("quantity", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.quantity
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Доставка по Китаю (₽)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={costData.chinaShipping || ""}
                onChange={(e) =>
                  handleCostDataChange("chinaShipping", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.chinaShipping
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Доставка до России (₽)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={costData.russiaShipping || ""}
                onChange={(e) =>
                  handleCostDataChange("russiaShipping", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.russiaShipping
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Фулфилмент + упаковка + приемка (₽)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={costData.fulfillment || ""}
                onChange={(e) =>
                  handleCostDataChange("fulfillment", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.fulfillment
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дополнительные расходы (₽)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={costData.additionalCosts || ""}
                onChange={(e) =>
                  handleCostDataChange("additionalCosts", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.additionalCosts
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
          </div>

          {/* Результаты себестоимости */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Себестоимость всех товаров:
              </h3>
              <div className="text-2xl font-bold text-blue-600">
                {totalCost.toFixed(2)} ₽
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">
                Себестоимость одного товара:
              </h3>
              <div className="text-2xl font-bold text-blue-600">
                {costPerItem.toFixed(2)} ₽
              </div>
            </div>
          </div>
        </div>

        {/* Калькулятор логистики */}
        <div className="bg-white rounded-lg text-gray-700 shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Калькулятор логистики Ozon
          </h2>
          <p className="text-gray-600 mb-4">
            Введите размеры упаковки в сантиметрах:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ширина (см)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={logisticsData.width || ""}
                onChange={(e) =>
                  handleLogisticsDataChange("width", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.width ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Например: 20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Длина (см)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={logisticsData.length || ""}
                onChange={(e) =>
                  handleLogisticsDataChange("length", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.length ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Например: 30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Высота (см)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={logisticsData.height || ""}
                onChange={(e) =>
                  handleLogisticsDataChange("height", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.height ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Например: 10"
              />
            </div>
          </div>

          {/* Детали расчета логистики */}
          {logisticsCalculation && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Детали расчета логистики:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Объем упаковки:</span>
                    <span className="font-medium">
                      {logisticsCalculation.liters} л
                    </span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Индекс (тариф):</span>
                    <span className="font-medium">
                      {logisticsCalculation.index} ₽/л
                    </span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Стоимость по тарифу:</span>
                    <span className="font-medium">
                      {logisticsCalculation.cost} ₽
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>+ Приемка ПВЗ:</span>
                    <span className="font-medium">25.00 ₽</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Итого с приемкой:</span>
                    <span className="font-medium">
                      {logisticsCalculation.withReception} ₽
                    </span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>+ 10% (надбавка):</span>
                    <span className="font-medium">
                      {(
                        parseFloat(logisticsCalculation.withReception) * 0.1
                      ).toFixed(2)}{" "}
                      ₽
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-gray-300">
                    <span className="font-semibold">
                      Общая стоимость логистики:
                    </span>
                    <span className="font-semibold text-blue-600">
                      {logisticsCalculation.total} ₽
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Расчет маржинальности */}
        <div className="bg-white text-gray-700 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            Расчет маржинальности и рентабельности
          </h2>

          {/* Ввод данных */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Цена продажи на Ozon (₽)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={marginData.sellingPrice || ""}
                onChange={(e) =>
                  handleMarginDataChange("sellingPrice", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.sellingPrice
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Вознаграждение Ozon (%)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={marginData.ozonRewardPercent || ""}
                onChange={(e) =>
                  handleMarginDataChange("ozonRewardPercent", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.ozonRewardPercent
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
              {marginData.ozonRewardPercent > 0 &&
                marginData.sellingPrice > 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    Сумма: {ozonRewardAmount.toFixed(2)} ₽
                  </div>
                )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Эквайринг (автоматически 1%)
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                {acquiringAmount.toFixed(2)} ₽
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Налог (%)
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={marginData.taxPercent || ""}
                onChange={(e) =>
                  handleMarginDataChange("taxPercent", e.target.value)
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.taxPercent
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="0"
              />
            </div>
          </div>

          {/* Таблица результатов */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left">
                    Показатель
                  </th>
                  <th className="border border-gray-300 p-3 text-left">
                    Значение
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">
                    Себестоимость одного товара
                  </td>
                  <td className="border border-gray-300 p-3">
                    {costPerItem.toFixed(2)} ₽
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">
                    Цена продажи
                  </td>
                  <td className="border border-gray-300 p-3">
                    {marginData.sellingPrice} ₽
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">
                    Вознаграждение Ozon ({marginData.ozonRewardPercent}%)
                  </td>
                  <td className="border border-gray-300 p-3">
                    {ozonRewardAmount.toFixed(2)} ₽
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">
                    Эквайринг (1%)
                  </td>
                  <td className="border border-gray-300 p-3">
                    {acquiringAmount.toFixed(2)} ₽
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">
                    Приемка+Логистика
                  </td>
                  <td className="border border-gray-300 p-3">
                    {logisticsCost.toFixed(2)} ₽
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3 font-semibold">
                    Общие расходы
                  </td>
                  <td className="border border-gray-300 p-3 font-semibold">
                    {totalExpenses.toFixed(2)} ₽
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">
                    Налог ({marginData.taxPercent}%)
                  </td>
                  <td className="border border-gray-300 p-3">
                    {taxAmount.toFixed(2)} ₽
                  </td>
                </tr>
                <tr className="bg-blue-50">
                  <td className="border border-gray-300 p-3 font-semibold">
                    Себестоимость full
                  </td>
                  <td className="border border-gray-300 p-3 font-semibold">
                    {fullCost.toFixed(2)} ₽
                  </td>
                </tr>
                <tr className={margin >= 0 ? "bg-green-50" : "bg-red-50"}>
                  <td className="border border-gray-300 p-3 font-semibold">
                    Маржинальность
                  </td>
                  <td className="border border-gray-300 p-3 font-semibold">
                    {margin.toFixed(2)} ₽ ({marginPercent.toFixed(2)}%)
                  </td>
                </tr>
                <tr
                  className={
                    profitabilityPercent >= 0 ? "bg-green-50" : "bg-red-50"
                  }
                >
                  <td className="border border-gray-300 p-3 font-semibold">
                    Рентабельность
                  </td>
                  <td className="border border-gray-300 p-3 font-semibold">
                    {profitabilityPercent.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Визуальная индикация */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Результат:</h3>
            {margin >= 0 ? (
              <div className="text-green-600 font-semibold">
                ✅ Товар прибыльный. Маржинальность: {margin.toFixed(2)} ₽ (
                {marginPercent.toFixed(2)}%)
              </div>
            ) : (
              <div className="text-red-600 font-semibold">
                ❌ Товар убыточный. Убыток: {Math.abs(margin).toFixed(2)} ₽
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
