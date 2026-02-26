import { NextResponse } from 'next/server';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    // 1. Получаем ВСЕ данные от клиента, включая ключи друга
    const { fromDate, toDate, deliverySchema, clientId, apiKey } = await request.json();

    // 2. Проверяем, что ключи прислали
    if (!clientId || !apiKey) {
      return NextResponse.json({ error: 'Ключи API не найдены' }, { status: 400 });
    }

    // 3. Используем ключи друга для запроса к Ozon
    const createRes = await fetch('https://api-seller.ozon.ru/v1/report/postings/create', {
      method: 'POST',
      headers: {
        'Client-Id': clientId,
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          processed_at_from: fromDate,
          processed_at_to: toDate,
          delivery_schema: [deliverySchema],
          statuses: [],
        },
        language: 'DEFAULT',
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.message || 'Ошибка создания отчета');
    const reportCode = createData.result.code;

    // 4. Ждем готовность (тоже с ключами друга)
    let fileUrl: string | null = null;
    for (let i = 0; i < 30; i++) {
      const infoRes = await fetch('https://api-seller.ozon.ru/v1/report/info', {
        method: 'POST',
        headers: {
          'Client-Id': clientId,
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: reportCode }),
      });

      const infoData = await infoRes.json();
      if (!infoRes.ok) {
        // Если ошибка, но не критичная, продолжаем ждать
        if (infoRes.status !== 404) {
          console.error('Info API Error:', infoData);
        }
        await sleep(2000);
        continue;
      }

      const status = infoData.result?.status;
      
      if (status === 'success') {
        fileUrl = infoData.result.file;
        break;
      } else if (status === 'error') {
        throw new Error(infoData.result.error || 'Ошибка формирования отчета');
      }
      
      await sleep(2000);
    }

    if (!fileUrl) throw new Error('Отчет не сформировался вовремя');

    // 5. Скачиваем файл (здесь ключи не нужны, это прямая ссылка)
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      throw new Error(`Ошибка скачивания файла: ${fileRes.status}`);
    }
    
    const fileBuffer = await fileRes.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="ozon_${deliverySchema}_${Date.now()}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}