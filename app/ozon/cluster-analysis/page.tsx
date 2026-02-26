// app/ozon/cluster-analysis/page.tsx (обновленная версия)
"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

interface ClusterProductData {
  cluster: string;
  productName: string;
  availableQuantity: number;
  sku: string;
  preparingForSale: number;
  expiringSoon: number;
  returningFromCustomers: number;
  dailySales28Days: number;
  liquidityStatus: string;
}

interface ClusterAnalysisData {
  clusters: string[];
  products: string[];
  data: {
    [productName: string]: {
      [cluster: string]: {
        available: number;
        preparing: number;
        expiring: number;
        returning: number;
        dailySales: number;
        liquidityStatus: string;
      };
    };
  };
  rawData: ClusterProductData[];
}

// Интерфейс для расширенных карточек
interface ExpandedCard {
  [productName: string]: boolean;
}

// Интерфейс для рекомендаций по кластерам
interface ClusterRecommendation {
  cluster: string;
  dailySales: number;
  available: number;
  daysLeft: number;
  recommendation:
    | "срочно поставить"
    | "требуется поставка"
    | "поставка не требуется";
}

export default function OzonClusterAnalysis() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<ClusterAnalysisData | null>(
    null
  );
  const [fileName, setFileName] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [expandedCards, setExpandedCards] = useState<ExpandedCard>({});

  // Ссылки на контейнеры таблиц для синхронной прокрутки
  const stocksTableRef = useRef<HTMLDivElement>(null);
  const liquidityTableRef = useRef<HTMLDivElement>(null);

  // Эффект для синхронизации горизонтальной прокрутки таблиц
  useEffect(() => {
    const stocksTable = stocksTableRef.current;
    const liquidityTable = liquidityTableRef.current;

    if (!stocksTable || !liquidityTable || !analysisData) return;

    const handleStocksScroll = () => {
      liquidityTable.scrollLeft = stocksTable.scrollLeft;
    };

    const handleLiquidityScroll = () => {
      stocksTable.scrollLeft = liquidityTable.scrollLeft;
    };

    stocksTable.addEventListener("scroll", handleStocksScroll);
    liquidityTable.addEventListener("scroll", handleLiquidityScroll);

    return () => {
      stocksTable.removeEventListener("scroll", handleStocksScroll);
      liquidityTable.removeEventListener("scroll", handleLiquidityScroll);
    };
  }, [analysisData]);

  // Функция для переключения расширенного вида карточки
  const toggleCardExpansion = (productName: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [productName]: !prev[productName],
    }));
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const sheetName =
        workbook.SheetNames.find(
          (name) =>
            name.toLowerCase().includes("товар-кластер") ||
            name.toLowerCase().includes("кластер")
        ) || workbook.SheetNames[1];

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      });

      const dataArray = jsonData as any[][];
      const parsedData = parseClusterSheet(dataArray);
      setAnalysisData(parsedData);
      setExpandedCards({});
    } catch (error) {
      console.error("Error parsing Excel:", error);
      alert("Ошибка при обработке файла. Проверьте формат файла.");
    } finally {
      setIsLoading(false);
    }
  };

  const parseClusterSheet = (data: any[][]): ClusterAnalysisData => {
    const clusterProductData: ClusterProductData[] = [];
    const clustersSet = new Set<string>();
    const productsSet = new Set<string>();

    if (!data || data.length < 5) {
      return {
        clusters: [],
        products: [],
        data: {},
        rawData: [],
      };
    }

    const startRowIndex = 4;

    const clusterIndex = 5;
    const productNameIndex = 1;
    const skuIndex = 2;
    const availableQuantityIndex = 10;
    const preparingForSaleIndex = 11;
    const expiringSoonIndex = 14;
    const returningFromCustomersIndex = 21;
    const dailySalesIndex = 8;
    const liquidityStatusIndex = 6;

    for (let i = startRowIndex; i < data.length; i++) {
      const row = data[i];
      if (
        !row ||
        row.length <=
          Math.max(
            clusterIndex,
            productNameIndex,
            availableQuantityIndex,
            preparingForSaleIndex,
            expiringSoonIndex,
            returningFromCustomersIndex,
            dailySalesIndex,
            liquidityStatusIndex
          )
      ) {
        continue;
      }

      const cluster = String(row[clusterIndex] || "").trim();
      const productName = String(row[productNameIndex] || "").trim();
      const sku = String(row[skuIndex] || "").trim();
      const availableQuantity = parseFloat(row[availableQuantityIndex]) || 0;
      const preparingForSale = parseFloat(row[preparingForSaleIndex]) || 0;
      const expiringSoon = parseFloat(row[expiringSoonIndex]) || 0;
      const returningFromCustomers =
        parseFloat(row[returningFromCustomersIndex]) || 0;
      const dailySales28Days = parseFloat(row[dailySalesIndex]) || 0;
      const liquidityStatus = String(row[liquidityStatusIndex] || "").trim();

      if (
        cluster &&
        productName &&
        !cluster.includes("Нередактируемое") &&
        !productName.includes("Нередактируемое") &&
        !cluster.includes("Кластер") &&
        !productName.includes("Название товара")
      ) {
        clusterProductData.push({
          cluster,
          productName,
          availableQuantity,
          sku,
          preparingForSale,
          expiringSoon,
          returningFromCustomers,
          dailySales28Days,
          liquidityStatus,
        });

        clustersSet.add(cluster);
        productsSet.add(productName);
      }
    }

    const clusters = Array.from(clustersSet);
    const products = Array.from(productsSet);

    const groupedData: {
      [productName: string]: {
        [cluster: string]: {
          available: number;
          preparing: number;
          expiring: number;
          returning: number;
          dailySales: number;
          liquidityStatus: string;
        };
      };
    } = {};

    products.forEach((product) => {
      groupedData[product] = {};
      clusters.forEach((cluster) => {
        groupedData[product][cluster] = {
          available: 0,
          preparing: 0,
          expiring: 0,
          returning: 0,
          dailySales: 0,
          liquidityStatus: "",
        };
      });
    });

    clusterProductData.forEach((item) => {
      if (
        groupedData[item.productName] &&
        groupedData[item.productName][item.cluster]
      ) {
        groupedData[item.productName][item.cluster] = {
          available: item.availableQuantity,
          preparing: item.preparingForSale,
          expiring: item.expiringSoon,
          returning: item.returningFromCustomers,
          dailySales: item.dailySales28Days,
          liquidityStatus: item.liquidityStatus,
        };
      }
    });

    return {
      clusters,
      products,
      data: groupedData,
      rawData: clusterProductData,
    };
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (
      files.length > 0 &&
      (files[0].name.endsWith(".xlsx") || files[0].name.endsWith(".xls"))
    ) {
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

  const calculateProductTotals = () => {
    if (!analysisData) return {};

    const totals: { [product: string]: number } = {};

    analysisData.products.forEach((product) => {
      let total = 0;
      analysisData.clusters.forEach((cluster) => {
        total += analysisData.data[product][cluster]?.available || 0;
      });
      totals[product] = total;
    });

    return totals;
  };

  const calculateClusterTotals = () => {
    if (!analysisData) return {};

    const totals: { [cluster: string]: number } = {};

    analysisData.clusters.forEach((cluster) => {
      let total = 0;
      analysisData.products.forEach((product) => {
        total += analysisData.data[product][cluster]?.available || 0;
      });
      totals[cluster] = total;
    });

    return totals;
  };

  const calculateProductDailySalesTotals = () => {
    if (!analysisData) return {};

    const totals: { [product: string]: number } = {};

    analysisData.products.forEach((product) => {
      let total = 0;
      analysisData.clusters.forEach((cluster) => {
        total += analysisData.data[product][cluster]?.dailySales || 0;
      });
      totals[product] = total;
    });

    return totals;
  };

  const calculateClusterDailySalesTotals = () => {
    if (!analysisData) return {};

    const totals: { [cluster: string]: number } = {};

    analysisData.clusters.forEach((cluster) => {
      let total = 0;
      analysisData.products.forEach((product) => {
        total += analysisData.data[product][cluster]?.dailySales || 0;
      });
      totals[cluster] = total;
    });

    return totals;
  };

  const calculateProductAdditionalTotals = () => {
    if (!analysisData) {
      return {
        preparingTotals: {},
        expiringTotals: {},
        returningTotals: {},
      };
    }

    const preparingTotals: { [product: string]: number } = {};
    const expiringTotals: { [product: string]: number } = {};
    const returningTotals: { [product: string]: number } = {};

    analysisData.products.forEach((product) => {
      let preparingTotal = 0;
      let expiringTotal = 0;
      let returningTotal = 0;

      analysisData.clusters.forEach((cluster) => {
        const data = analysisData.data[product][cluster];
        if (data) {
          preparingTotal += data.preparing || 0;
          expiringTotal += data.expiring || 0;
          returningTotal += data.returning || 0;
        }
      });

      preparingTotals[product] = preparingTotal;
      expiringTotals[product] = expiringTotal;
      returningTotals[product] = returningTotal;
    });

    return { preparingTotals, expiringTotals, returningTotals };
  };

  // Функция для расчета дней до конца остатка по товару
  const calculateDaysLeftForProduct = (productName: string) => {
    if (!analysisData) return 0;

    const productTotals = calculateProductTotals();
    const salesTotals = calculateProductDailySalesTotals();

    const totalQuantity = productTotals[productName] || 0;
    const totalDailySales = salesTotals[productName] || 0;

    if (totalDailySales <= 0) return Infinity; // Если нет продаж, то товара хватит навсегда

    return totalQuantity / totalDailySales;
  };

  // Функция для определения рекомендации по товару
  const getProductRecommendation = (productName: string) => {
    const daysLeft = calculateDaysLeftForProduct(productName);

    if (daysLeft <= 28) {
      return {
        text: "срочно поставить",
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
      };
    } else if (daysLeft <= 56) {
      return {
        text: "требуется поставить",
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
      };
    } else if (daysLeft <= 120) {
      return {
        text: "пока хватает",
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      };
    } else {
      return {
        text: "избыточно",
        color: "text-gray-600",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
      };
    }
  };

  // Функция для получения рекомендаций по кластерам для конкретного товара
  const getClusterRecommendations = (
    productName: string
  ): ClusterRecommendation[] => {
    if (!analysisData) return [];

    const clustersWithData = analysisData.clusters
      .filter((cluster) => {
        const data = analysisData.data[productName][cluster];
        return data && (data.available > 0 || data.dailySales > 0);
      })
      .map((cluster) => {
        const data = analysisData.data[productName][cluster];
        const dailySales = data?.dailySales || 0;
        const available = data?.available || 0;

        // Рассчитываем дней остатка для кластера
        let daysLeft = Infinity;
        if (dailySales > 0) {
          daysLeft = available / dailySales;
        } else if (available > 0) {
          daysLeft = Infinity; // Есть остатки, но нет продаж
        } else {
          daysLeft = 0; // Нет остатков и нет продаж
        }

        // Определяем рекомендацию для кластера
        let recommendation:
          | "срочно поставить"
          | "требуется поставка"
          | "поставка не требуется";
        if (daysLeft <= 50 || available === 0) {
          recommendation = "срочно поставить";
        } else if (daysLeft <= 120) {
          recommendation = "требуется поставка";
        } else {
          recommendation = "поставка не требуется";
        }

        return {
          cluster,
          dailySales,
          available,
          daysLeft,
          recommendation,
        };
      });

    // Сортируем по среднесуточным продажам (от большего к меньшему)
    return clustersWithData.sort((a, b) => b.dailySales - a.dailySales);
  };

  const getLiquidityColor = (status: string) => {
    if (!status) return "bg-gray-100";

    const statusLower = status.toLowerCase();

    if (statusLower.includes("дефицит")) return "bg-green-100 border-green-300";
    if (statusLower.includes("очень популярн"))
      return "bg-blue-100 border-blue-300";
    if (statusLower.includes("популярн") && !statusLower.includes("очень"))
      return "bg-yellow-100 border-yellow-300";
    if (statusLower.includes("избыточн"))
      return "bg-orange-100 border-orange-300";
    if (statusLower.includes("без продаж")) return "bg-red-100 border-red-300";

    return "bg-gray-100 border-gray-300";
  };

  const getSortedProducts = () => {
    const totals = calculateProductTotals();
    return (
      analysisData?.products.sort(
        (a, b) => (totals[b] || 0) - (totals[a] || 0)
      ) || []
    );
  };

  const getSortedClusters = () => {
    const totals = calculateClusterTotals();
    return (
      analysisData?.clusters.sort(
        (a, b) => (totals[b] || 0) - (totals[a] || 0)
      ) || []
    );
  };

  const getProductsSortedBySales = () => {
    const salesTotals = calculateProductDailySalesTotals();
    return (
      analysisData?.products.sort(
        (a, b) => (salesTotals[b] || 0) - (salesTotals[a] || 0)
      ) || []
    );
  };

  const getClustersWithProductsCount = () => {
    if (!analysisData) return 0;

    const clusterTotals = calculateClusterTotals();
    return Object.values(clusterTotals).filter((total) => total > 0).length;
  };

  const getTotalDailySales = () => {
    if (!analysisData) return 0;

    const salesTotals = calculateProductDailySalesTotals();
    return Object.values(salesTotals).reduce((sum, total) => sum + total, 0);
  };

  // Расчет высоты для контейнера (5 строк + заголовок + итоговая строка)
  const calculateTableHeight = () => {
    const visibleRows = 5;
    const headerHeight = 60;
    const rowHeight = 50;
    const footerHeight = 50;

    return headerHeight + rowHeight * visibleRows + footerHeight;
  };

  // Получаем список товаров для отображения в статистике
  const getProductsToShow = () => {
    const sortedProducts = getSortedProducts();
    return showAllProducts ? sortedProducts : sortedProducts.slice(0, 3);
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
          Кластерный анализ остатков Ozon
        </h1>
        <p className="text-gray-600 mb-8">
          Загрузите отчет в формате XLSX для анализа остатков товаров по
          кластерам
        </p>

        {/* Блок загрузки файла */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Загрузка отчета по кластерам
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
              accept=".xlsx,.xls"
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
                Поддерживается только XLSX формат отчетов Ozon (лист
                "Товар-кластер")
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

        {/* Результаты анализа */}
        {analysisData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Анализ остатков по кластерам
            </h2>

            {/* Сводная информация */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {getClustersWithProductsCount()}
                </div>
                <div className="text-sm text-gray-600">Кластеры с товарами</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {analysisData.products.length}
                </div>
                <div className="text-sm text-gray-600">Всего товаров</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {analysisData.rawData.reduce(
                    (sum, item) => sum + item.availableQuantity,
                    0
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  Общее количество остатков
                </div>
              </div>
              <div className="bg-teal-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-teal-600">
                  {getTotalDailySales().toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  Среднесуточные продажи
                </div>
              </div>
            </div>

            {/* ТАБЛИЦА ОСТАТКОВ */}
            <div className="mb-8 text-gray-800">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    Остатки товаров по кластерам
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Товары по строкам, кластеры по столбцам. Показано{" "}
                    {Math.min(5, getSortedProducts().length)} из{" "}
                    {getSortedProducts().length} товаров
                  </p>
                </div>
                {getSortedProducts().length > 5 && (
                  <div className="text-sm text-gray-500">
                    ↕ Прокрутка доступна ({getSortedProducts().length} товаров)
                  </div>
                )}
              </div>

              <div
                ref={stocksTableRef}
                className="overflow-x-auto border border-gray-300 rounded-lg"
                style={{
                  height: `${calculateTableHeight()}px`,
                  overflowY: "auto",
                  overflowX: "auto",
                }}
              >
                <div className="min-w-max">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 text-left border-b border-r border-gray-300 sticky left-0 top-0 bg-gray-100 z-20 min-w-[200px]">
                          Товар
                        </th>
                        {getSortedClusters().map((cluster, index) => (
                          <th
                            key={index}
                            className="p-3 text-left border-b border-gray-300 min-w-[120px] sticky top-0 bg-gray-100 z-10"
                          >
                            <div
                              className="truncate max-w-[120px]"
                              title={cluster}
                            >
                              {cluster}
                            </div>
                          </th>
                        ))}
                        <th className="p-3 text-left border-b border-gray-300 bg-blue-50 font-semibold min-w-[100px] sticky top-0 bg-blue-50 z-10">
                          Всего
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedProducts().map((product, productIndex) => {
                        const productTotals = calculateProductTotals();
                        const total = productTotals[product] || 0;

                        return (
                          <tr
                            key={productIndex}
                            className={
                              productIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="p-3 border-b border-r border-gray-300 sticky left-0 bg-white z-10 font-medium">
                              <div
                                className="truncate max-w-[200px]"
                                title={product}
                              >
                                {product}
                              </div>
                            </td>
                            {getSortedClusters().map(
                              (cluster, clusterIndex) => {
                                const quantity =
                                  analysisData.data[product][cluster]
                                    ?.available || 0;
                                let bgColor = "";

                                if (quantity === 0) {
                                  bgColor = "bg-red-50";
                                } else if (quantity <= 2) {
                                  bgColor = "bg-yellow-50";
                                } else if (quantity <= 5) {
                                  bgColor = "bg-green-50";
                                } else {
                                  bgColor = "bg-blue-50";
                                }

                                return (
                                  <td
                                    key={clusterIndex}
                                    className={`p-3 border-b border-gray-300 text-center ${bgColor}`}
                                  >
                                    {quantity > 0 ? quantity : "-"}
                                  </td>
                                );
                              }
                            )}
                            <td className="p-3 border-b border-gray-300 text-center font-semibold bg-blue-50">
                              {total}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Строка с итогами по кластерам */}
                      <tr className="bg-gray-100">
                        <td className="p-3 border-b border-r border-gray-300 sticky left-0 bg-gray-100 z-10 font-semibold">
                          Всего
                        </td>
                        {getSortedClusters().map((cluster, index) => {
                          const clusterTotals = calculateClusterTotals();
                          const total = clusterTotals[cluster] || 0;

                          return (
                            <td
                              key={index}
                              className="p-3 border-b border-gray-300 text-center font-semibold bg-blue-50"
                            >
                              {total}
                            </td>
                          );
                        })}
                        <td className="p-3 border-b border-gray-300 text-center font-bold bg-blue-100">
                          {analysisData.rawData.reduce(
                            (sum, item) => sum + item.availableQuantity,
                            0
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ТАБЛИЦА ЛИКВИДНОСТИ */}
            <div className="mb-8 text-gray-800">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    Анализ ликвидности по кластерам
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Среднесуточные продажи за 28 дней. Показано{" "}
                    {Math.min(5, getProductsSortedBySales().length)} из{" "}
                    {getProductsSortedBySales().length} товаров
                  </p>
                </div>
                {getProductsSortedBySales().length > 5 && (
                  <div className="text-sm text-gray-500">
                    ↕ Прокрутка доступна ({getProductsSortedBySales().length}{" "}
                    товаров)
                  </div>
                )}
              </div>

              <div
                ref={liquidityTableRef}
                className="overflow-x-auto border border-gray-300 rounded-lg"
                style={{
                  height: `${calculateTableHeight()}px`,
                  overflowY: "auto",
                  overflowX: "auto",
                }}
              >
                <div className="min-w-max">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 text-left border-b border-r border-gray-300 sticky left-0 top-0 bg-gray-100 z-20 min-w-[200px]">
                          Товар
                        </th>
                        {getSortedClusters().map((cluster, index) => (
                          <th
                            key={index}
                            className="p-3 text-left border-b border-gray-300 min-w-[120px] sticky top-0 bg-gray-100 z-10"
                          >
                            <div
                              className="truncate max-w-[120px]"
                              title={cluster}
                            >
                              {cluster}
                            </div>
                          </th>
                        ))}
                        <th className="p-3 text-left border-b border-gray-300 bg-teal-50 font-semibold min-w-[100px] sticky top-0 bg-teal-50 z-10">
                          Всего продаж/день
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getProductsSortedBySales().map(
                        (product, productIndex) => {
                          const salesTotals =
                            calculateProductDailySalesTotals();
                          const totalSales = salesTotals[product] || 0;

                          return (
                            <tr
                              key={productIndex}
                              className={
                                productIndex % 2 === 0
                                  ? "bg-white"
                                  : "bg-gray-50"
                              }
                            >
                              <td className="p-3 border-b border-r border-gray-300 sticky left-0 bg-white z-10 font-medium">
                                <div
                                  className="truncate max-w-[200px]"
                                  title={product}
                                >
                                  {product}
                                </div>
                              </td>
                              {getSortedClusters().map(
                                (cluster, clusterIndex) => {
                                  const dailySales =
                                    analysisData.data[product][cluster]
                                      ?.dailySales || 0;
                                  const liquidityStatus =
                                    analysisData.data[product][cluster]
                                      ?.liquidityStatus || "";

                                  const bgColor =
                                    getLiquidityColor(liquidityStatus);

                                  return (
                                    <td
                                      key={clusterIndex}
                                      className={`p-3 border-b border-gray-300 text-center ${bgColor}`}
                                      title={`${dailySales} продаж/день, статус: ${
                                        liquidityStatus || "не указан"
                                      }`}
                                    >
                                      {dailySales > 0
                                        ? dailySales.toFixed(2)
                                        : "-"}
                                    </td>
                                  );
                                }
                              )}
                              <td className="p-3 border-b border-gray-300 text-center font-semibold bg-teal-50">
                                {totalSales > 0 ? totalSales.toFixed(2) : "-"}
                              </td>
                            </tr>
                          );
                        }
                      )}

                      {/* Строка с итогами по кластерам для продаж */}
                      <tr className="bg-gray-100">
                        <td className="p-3 border-b border-r border-gray-300 sticky left-0 bg-gray-100 z-10 font-semibold">
                          Всего продаж/день
                        </td>
                        {getSortedClusters().map((cluster, index) => {
                          const clusterSalesTotals =
                            calculateClusterDailySalesTotals();
                          const total = clusterSalesTotals[cluster] || 0;

                          return (
                            <td
                              key={index}
                              className="p-3 border-b border-gray-300 text-center font-semibold bg-teal-50"
                            >
                              {total > 0 ? total.toFixed(2) : "-"}
                            </td>
                          );
                        })}
                        <td className="p-3 border-b border-gray-300 text-center font-bold bg-teal-100">
                          {getTotalDailySales().toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ЛЕГЕНДА СТАТУСОВ ЛИКВИДНОСТИ (после таблицы) */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">
                  Легенда статусов ликвидности:
                </h4>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-2"></div>
                    <span className="text-sm">Дефицитный / Был дефицитный</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded mr-2"></div>
                    <span className="text-sm">
                      Очень популярный / Был очень популярный
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded mr-2"></div>
                    <span className="text-sm">Популярный / Был популярный</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded mr-2"></div>
                    <span className="text-sm">Избыточный / Был избыточный</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded mr-2"></div>
                    <span className="text-sm">Без продаж / Был без продаж</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Сводная информация по товарам */}
            <div className="mb-6 text-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  Статистика по товарам с рекомендациями
                </h3>
                {getSortedProducts().length > 3 && (
                  <button
                    onClick={() => setShowAllProducts(!showAllProducts)}
                    className="text-blue-500 hover:text-blue-700 font-medium"
                  >
                    {showAllProducts
                      ? "Скрыть"
                      : `Показать все (${getSortedProducts().length})`}
                  </button>
                )}
              </div>

              <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${
                  showAllProducts ? "max-h-auto" : ""
                }`}
              >
                {getProductsToShow().map((product, index) => {
                  const totals = calculateProductTotals();
                  const salesTotals = calculateProductDailySalesTotals();
                  const additionalTotals = calculateProductAdditionalTotals();
                  const total = totals[product] || 0;
                  const totalSales = salesTotals[product] || 0;
                  const preparingTotal =
                    additionalTotals?.preparingTotals?.[product] || 0;
                  const expiringTotal =
                    additionalTotals?.expiringTotals?.[product] || 0;
                  const returningTotal =
                    additionalTotals?.returningTotals?.[product] || 0;
                  const productClusters = analysisData.clusters.filter(
                    (cluster) =>
                      analysisData.data[product][cluster]?.available > 0
                  );
                  const isExpanded = expandedCards[product] || false;

                  // Получаем рекомендацию для товара
                  const productRecommendation =
                    getProductRecommendation(product);
                  const daysLeft = calculateDaysLeftForProduct(product);
                  const daysLeftText = isFinite(daysLeft)
                    ? daysLeft.toFixed(1)
                    : "∞";

                  // Получаем рекомендации по кластерам
                  const clusterRecommendations =
                    getClusterRecommendations(product);
                  const firstRecommendation = clusterRecommendations[0];

                  return (
                    <div
                      key={index}
                      className={`bg-gray-50 rounded-lg border border-gray-200 flex flex-col transition-all duration-300 ${
                        isExpanded
                          ? "fixed inset-0 md:inset-8 lg:inset-12 z-50 bg-white/95 backdrop-blur-sm"
                          : "relative h-full"
                      }`}
                    >
                      {/* Затемнение фона при открытии */}
                      {isExpanded && (
                        <div
                          className="fixed inset-0 bg-black/50 z-40"
                          onClick={() => toggleCardExpansion(product)}
                        />
                      )}

                      <div
                        className={`p-4 flex-grow ${
                          isExpanded
                            ? "max-w-5xl mx-auto w-full bg-white rounded-xl shadow-2xl z-50 relative max-h-[90vh] overflow-y-auto"
                            : ""
                        }`}
                      >
                        {/* Заголовок карточки */}
                        <div className="flex justify-between items-start mb-3">
                          <h4
                            className={`font-semibold text-gray-800 flex-1 mr-2 ${
                              isExpanded ? "text-2xl" : "text-sm line-clamp-2"
                            }`}
                            title={product}
                            style={
                              !isExpanded
                                ? {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }
                                : {}
                            }
                          >
                            {product}
                          </h4>
                          <div className="flex flex-col items-end">
                            <span
                              className={`font-bold text-blue-600 whitespace-nowrap ${
                                isExpanded ? "text-2xl" : "text-lg"
                              }`}
                            >
                              {total} шт
                            </span>
                            {totalSales > 0 && (
                              <span
                                className={`text-teal-600 whitespace-nowrap ${
                                  isExpanded ? "text-lg" : "text-sm"
                                }`}
                              >
                                {totalSales.toFixed(2)} прод./день
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Рекомендация по товару (компактная) */}
                        <div
                          className={`mb-3 p-2 rounded-lg border ${productRecommendation.bgColor} ${productRecommendation.borderColor}`}
                        >
                          <div className="flex justify-between items-center">
                            <span
                              className={`font-medium ${productRecommendation.color}`}
                            >
                              {productRecommendation.text}
                            </span>
                            <span className="text-sm text-gray-600">
                              {daysLeftText} дней остатка
                            </span>
                          </div>
                        </div>

                        {/* Основная информация */}
                        <div className="space-y-2 mb-3">
                          <div className="text-gray-600 flex justify-between">
                            <span
                              className={isExpanded ? "text-base" : "text-sm"}
                            >
                              Кластеров:
                            </span>
                            <span
                              className={`font-medium ${
                                isExpanded ? "text-base" : "text-sm"
                              }`}
                            >
                              {productClusters.length}
                            </span>
                          </div>
                          {totalSales > 0 && (
                            <div className="text-gray-600 flex justify-between">
                              <span
                                className={isExpanded ? "text-base" : "text-sm"}
                              >
                                Среднесуточные продажи:
                              </span>
                              <span
                                className={`font-medium ${
                                  isExpanded ? "text-base" : "text-sm"
                                }`}
                              >
                                {totalSales.toFixed(2)} шт
                              </span>
                            </div>
                          )}
                          <div className="text-gray-600 flex justify-between">
                            <span
                              className={isExpanded ? "text-base" : "text-sm"}
                            >
                              Готовится к продаже:
                            </span>
                            <span
                              className={`font-medium ${
                                isExpanded ? "text-base" : "text-sm"
                              }`}
                            >
                              {preparingTotal} шт
                            </span>
                          </div>
                          <div className="text-gray-600 flex justify-between">
                            <span
                              className={isExpanded ? "text-base" : "text-sm"}
                            >
                              Истекает срок годности:
                            </span>
                            <span
                              className={`font-medium ${
                                isExpanded ? "text-base" : "text-sm"
                              }`}
                            >
                              {expiringTotal} шт
                            </span>
                          </div>
                          <div className="text-gray-600 flex justify-between">
                            <span
                              className={isExpanded ? "text-base" : "text-sm"}
                            >
                              Возвращаются от покупателя:
                            </span>
                            <span
                              className={`font-medium ${
                                isExpanded ? "text-base" : "text-sm"
                              }`}
                            >
                              {returningTotal} шт
                            </span>
                          </div>
                        </div>

                        {/* Первая рекомендация по кластерам (только в обычном режиме) */}
                        {!isExpanded && firstRecommendation && (
                          <div className="mt-3">
                            <div className="text-gray-700 font-medium mb-2 text-sm">
                              Первая рекомендация по кластерам:
                            </div>
                            <div
                              className={`p-2 rounded border ${
                                firstRecommendation.recommendation ===
                                "срочно поставить"
                                  ? "bg-red-50 border-red-200"
                                  : firstRecommendation.recommendation ===
                                    "требуется поставка"
                                  ? "bg-orange-50 border-orange-200"
                                  : "bg-green-50 border-green-200"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span
                                  className={`font-medium text-sm ${
                                    firstRecommendation.recommendation ===
                                    "срочно поставить"
                                      ? "text-red-600"
                                      : firstRecommendation.recommendation ===
                                        "требуется поставка"
                                      ? "text-orange-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {firstRecommendation.cluster}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {isFinite(firstRecommendation.daysLeft)
                                    ? firstRecommendation.daysLeft.toFixed(1)
                                    : "∞"}{" "}
                                  дней
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <div>
                                  <span className="text-gray-600">
                                    Остаток:{" "}
                                  </span>
                                  <span className="font-medium">
                                    {firstRecommendation.available} шт
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">
                                    Продажи:{" "}
                                  </span>
                                  <span className="font-medium">
                                    {firstRecommendation.dailySales.toFixed(2)}
                                    /день
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-xs font-medium">
                                {firstRecommendation.recommendation}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Полные рекомендации по кластерам (только в расширенном режиме) */}
                        {isExpanded && clusterRecommendations.length > 0 && (
                          <div className="mt-6">
                            <h5 className="text-lg font-semibold text-gray-800 mb-4">
                              Рекомендации по кластерам:
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {clusterRecommendations.map(
                                (recommendation, clusterIndex) => {
                                  // Цвет для рекомендации
                                  let recColor = "";
                                  let recBgColor = "";
                                  let recBorderColor = "";

                                  if (
                                    recommendation.recommendation ===
                                    "срочно поставить"
                                  ) {
                                    recColor = "text-red-600";
                                    recBgColor = "bg-red-50";
                                    recBorderColor = "border-red-200";
                                  } else if (
                                    recommendation.recommendation ===
                                    "требуется поставка"
                                  ) {
                                    recColor = "text-orange-600";
                                    recBgColor = "bg-orange-50";
                                    recBorderColor = "border-orange-200";
                                  } else {
                                    recColor = "text-green-600";
                                    recBgColor = "bg-green-50";
                                    recBorderColor = "border-green-200";
                                  }

                                  const daysLeftText = isFinite(
                                    recommendation.daysLeft
                                  )
                                    ? recommendation.daysLeft.toFixed(1)
                                    : "∞";

                                  return (
                                    <div
                                      key={clusterIndex}
                                      className={`p-3 rounded-lg border ${recBgColor} ${recBorderColor} transition-transform hover:scale-[1.02]`}
                                    >
                                      <div className="flex justify-between items-center mb-2">
                                        <span
                                          className={`font-semibold ${recColor}`}
                                        >
                                          {recommendation.cluster}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                          {daysLeftText} дней
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-sm mb-2">
                                        <div>
                                          <span className="text-gray-600">
                                            Остаток:{" "}
                                          </span>
                                          <span className="font-medium">
                                            {recommendation.available} шт
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">
                                            Продажи:{" "}
                                          </span>
                                          <span className="font-medium">
                                            {recommendation.dailySales.toFixed(
                                              2
                                            )}
                                            /день
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-2">
                                        <div
                                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${recColor} ${recBgColor}`}
                                        >
                                          {recommendation.recommendation}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                        {/* График дней остатка по кластерам (только в расширенном режиме) */}
                        {isExpanded && clusterRecommendations.length > 0 && (
                          <div className="mt-8">
                            <h5 className="text-lg font-semibold text-gray-800 mb-4">
                              Диаграмма дней остатка по кластерам:
                            </h5>
                            <div className="space-y-2">
                              {clusterRecommendations
                                .filter((rec) => isFinite(rec.daysLeft))
                                .sort((a, b) => b.daysLeft - a.daysLeft)
                                .slice(0, 10)
                                .map((recommendation, index) => {
                                  const days = recommendation.daysLeft;
                                  const maxDays = Math.max(
                                    ...clusterRecommendations
                                      .filter((rec) => isFinite(rec.daysLeft))
                                      .map((rec) => rec.daysLeft)
                                  );
                                  const percentage = (days / maxDays) * 100;

                                  let barColor = "";
                                  if (days <= 50) barColor = "bg-red-500";
                                  else if (days <= 120)
                                    barColor = "bg-orange-500";
                                  else barColor = "bg-green-500";

                                  return (
                                    <div key={index} className="space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span className="font-medium">
                                          {recommendation.cluster}
                                        </span>
                                        <span className="text-gray-600">
                                          {days.toFixed(1)} дней
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div
                                          className={`${barColor} h-3 rounded-full transition-all duration-500`}
                                          style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Кнопка открыть/скрыть */}
                      <div
                        className={`p-3 border-t border-gray-200 ${
                          isExpanded
                            ? "bg-white rounded-b-xl"
                            : "bg-gray-50 rounded-b-lg"
                        }`}
                      >
                        <button
                          onClick={() => toggleCardExpansion(product)}
                          className={`w-full font-medium transition-all duration-300 ${
                            isExpanded
                              ? "bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
                              : "text-blue-500 hover:text-blue-700 text-sm py-1"
                          }`}
                        >
                          {isExpanded
                            ? "✕ Закрыть детализацию"
                            : "📊 Открыть детализацию →"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!showAllProducts && getSortedProducts().length > 3 && (
                <div className="mt-4 text-center text-gray-500 text-sm">
                  Показаны первые 3 товара из {getSortedProducts().length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Инструкция */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-yellow-800 mb-2">
            Как получить отчет по остаткам из Ozon?
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-700">
            <li>Зайдите в личный кабинет продавца Ozon</li>
            <li>Перейдите в раздел "Аналитика" → "Отчеты"</li>
            <li>Продажи со склада озон → Управление остатками "</li>
            <li>Все склады → скачать отчет</li>
            <li>Загрузите отчет в форму выше </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
