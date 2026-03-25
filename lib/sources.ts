// lib/sources.ts
// Data source connectors — fetch financial data using Token Vault tokens
// All functions are read-only. Tokens are fetched from Auth0 Token Vault.

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  balance?: number;
  category?: string;
}

export interface FinancialSummary {
  source: string;
  transactions: Transaction[];
  totalCredits: number;
  totalDebits: number;
  avgMonthlyIncome: number;
  monthlyBreakdown: { month: string; income: number; expenses: number }[];
  oldestRecord: string;
  newestRecord: string;
}

// ============================================================
// MONO CONNECT — Bank account data
// Docs: docs.mono.co
// ============================================================

export async function fetchMonoData(accessToken: string): Promise<FinancialSummary> {
  const isTest = process.env.MONO_ENV === 'test';

  if (isTest) return getMockMonoData();

  // Get account ID first
  const accountRes = await fetch('https://api.withmono.com/v2/accounts', {
    headers: {
      'mono-sec-key': process.env.MONO_SECRET_KEY!,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!accountRes.ok) throw new Error('Mono: failed to fetch accounts');
  const accounts = await accountRes.json();
  const accountId = accounts.data?.[0]?.id;

  // Fetch 18 months of transactions
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 18);

  const txRes = await fetch(
    `https://api.withmono.com/v2/accounts/${accountId}/transactions?` +
    new URLSearchParams({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      paginate: 'false',
    }),
    {
      headers: {
        'mono-sec-key': process.env.MONO_SECRET_KEY!,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const txData = await txRes.json();
  const transactions: Transaction[] = txData.data.map((t: any) => ({
    id: t.id,
    date: t.date,
    amount: Math.abs(t.amount) / 100, // Mono returns kobo
    type: t.type === 'debit' ? 'debit' : 'credit',
    description: t.narration,
    balance: t.balance / 100,
    category: t.category,
  }));

  return summariseTransactions('Mono Connect', transactions);
}

// ============================================================
// OPAY — Mobile wallet transaction history
// ============================================================

export async function fetchOpayData(accessToken: string): Promise<FinancialSummary> {
  const isTest = process.env.OPAY_BASE_URL?.includes('sandbox');

  if (isTest) return getMockOpayData();

  const res = await fetch(`${process.env.OPAY_BASE_URL}/api/v3/transaction/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      MerchantId: process.env.OPAY_MERCHANT_ID!,
    },
    body: JSON.stringify({
      pageSize: 500,
      pageNo: 1,
      startTime: Date.now() - 18 * 30 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
    }),
  });

  if (!res.ok) throw new Error('OPay: failed to fetch transactions');

  const data = await res.json();
  const transactions: Transaction[] = (data.data?.list || []).map((t: any) => ({
    id: t.orderNo,
    date: new Date(t.createTime).toISOString(),
    amount: t.amount / 100,
    type: t.transType === 'in' ? 'credit' : 'debit',
    description: t.remark || t.orderType,
    balance: t.balance / 100,
  }));

  return summariseTransactions('OPay Wallet', transactions);
}

// ============================================================
// REMITA — Utility payment history
// ============================================================

export async function fetchRemitaData(accessToken: string): Promise<FinancialSummary> {
  if (process.env.REMITA_BASE_URL?.includes('demo')) return getMockRemitaData();

  const res = await fetch(`${process.env.REMITA_BASE_URL}/exapp/api/v1/send/api/echannelsvc/merchant/api/payerverification/payment/history`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apiKey: process.env.REMITA_API_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error('Remita: failed to fetch payment history');

  const data = await res.json();
  const transactions: Transaction[] = (data.responseData || []).map((t: any) => ({
    id: t.transactionId,
    date: t.transactionDate,
    amount: parseFloat(t.amount),
    type: 'debit',
    description: t.serviceName || 'Utility payment',
    category: 'utility',
  }));

  return summariseTransactions('Remita', transactions);
}

// ============================================================
// COOPERATIVE — Mock API (no public API, real integration via custom agreement)
// ============================================================

export async function fetchCooperativeData(accessToken: string): Promise<FinancialSummary> {
  // Cooperative data is fetched via a custom API built on top of their records system
  // For sandbox: return realistic mock data
  return getMockCoopData();
}

// ============================================================
// DATA SUMMARISATION — common analytics across all sources
// ============================================================

function summariseTransactions(source: string, transactions: Transaction[]): FinancialSummary {
  const credits = transactions.filter(t => t.type === 'credit');
  const debits = transactions.filter(t => t.type === 'debit');

  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebits = debits.reduce((s, t) => s + t.amount, 0);

  // Group by month
  const monthMap = new Map<string, { income: number; expenses: number }>();
  transactions.forEach(t => {
    const month = t.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) monthMap.set(month, { income: 0, expenses: 0 });
    const m = monthMap.get(month)!;
    if (t.type === 'credit') m.income += t.amount;
    else m.expenses += t.amount;
  });

  const monthlyBreakdown = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const avgMonthlyIncome = monthlyBreakdown.length > 0
    ? monthlyBreakdown.reduce((s, m) => s + m.income, 0) / monthlyBreakdown.length
    : 0;

  return {
    source,
    transactions,
    totalCredits,
    totalDebits,
    avgMonthlyIncome,
    monthlyBreakdown,
    oldestRecord: transactions.length ? transactions[transactions.length - 1].date : '',
    newestRecord: transactions.length ? transactions[0].date : '',
  };
}

// ============================================================
// MOCK DATA — realistic Nigerian trader financial profiles
// ============================================================

function getMockMonoData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();

  for (let m = 17; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    // Market income (6 days a week, varying amounts)
    const marketDays = m === 0 ? 15 : 24;
    for (let d = 0; d < marketDays; d++) {
      const dayDate = new Date(date);
      dayDate.setDate(d + 1);
      const isFestive = date.getMonth() === 11 || date.getMonth() === 3; // Dec, Apr (Eid)
      const baseIncome = isFestive ? 12000 : 7500;

      transactions.push({
        id: `mono-${m}-${d}`,
        date: dayDate.toISOString(),
        amount: baseIncome + Math.floor(Math.random() * 4000),
        type: 'credit',
        description: 'POS Transfer - Fabric sales',
        category: 'business_income',
      });
    }

    // Monthly expenses
    transactions.push(
      { id: `rent-${m}`, date: `${date.toISOString().substring(0, 7)}-05`, amount: 35000, type: 'debit', description: 'Shop rent - Oje Market', category: 'rent' },
      { id: `stock-${m}`, date: `${date.toISOString().substring(0, 7)}-03`, amount: 80000, type: 'debit', description: 'Fabric stock purchase', category: 'inventory' }
    );
  }

  return summariseTransactions('Mono Connect', transactions);
}

function getMockOpayData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();

  for (let m = 17; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    // OPay transfers from customers
    for (let d = 0; d < 20; d++) {
      transactions.push({
        id: `opay-${m}-${d}`,
        date: new Date(date.getFullYear(), date.getMonth(), d + 1).toISOString(),
        amount: 2500 + Math.floor(Math.random() * 8000),
        type: 'credit',
        description: 'Transfer received',
        category: 'income',
      });
    }

    // Mobile bill payments
    transactions.push({
      id: `airtime-${m}`,
      date: `${date.toISOString().substring(0, 7)}-10`,
      amount: 5000,
      type: 'debit',
      description: 'Airtime purchase',
    });
  }

  return summariseTransactions('OPay Wallet', transactions);
}

function getMockRemitaData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();

  for (let m = 11; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    transactions.push(
      { id: `electric-${m}`, date: `${date.toISOString().substring(0, 7)}-01`, amount: 8500, type: 'debit', description: 'IBEDC Electricity bill', category: 'utility' },
      { id: `water-${m}`, date: `${date.toISOString().substring(0, 7)}-02`, amount: 3200, type: 'debit', description: 'Oyo State Water Corporation', category: 'utility' }
    );
  }

  return summariseTransactions('Remita', transactions);
}

function getMockCoopData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();

  for (let m = 23; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    transactions.push({
      id: `coop-savings-${m}`,
      date: `${date.toISOString().substring(0, 7)}-15`,
      amount: 15000,
      type: 'debit',
      description: 'Ibadan Traders Cooperative - monthly savings',
      category: 'savings',
    });
  }

  return summariseTransactions('Cooperative', transactions);
}
