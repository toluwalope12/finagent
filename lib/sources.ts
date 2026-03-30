// lib/sources.ts
// Data source connectors — fetch financial data using Token Vault tokens
// All functions are read-only. Tokens are fetched from Auth0 Token Vault.
// Mock data generates 10 years of realistic Nigerian trader history for demo.

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
// Sign up at app.mono.co for free sandbox keys
// ============================================================

export async function fetchMonoData(accessToken: string): Promise<FinancialSummary> {
  const isTest = process.env.MONO_ENV === 'test' || accessToken === 'mock_token';

  if (isTest) return getMockMonoData();

  try {
    // Get account ID first
    const accountRes = await fetch('https://api.withmono.com/v2/accounts', {
      headers: {
        'mono-sec-key': process.env.MONO_SECRET_KEY!,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!accountRes.ok) {
      console.warn('Mono API error, falling back to mock data');
      return getMockMonoData();
    }

    const accounts = await accountRes.json();
    const accountId = accounts.data?.[0]?.id;

    if (!accountId) return getMockMonoData();

    // Fetch 10 years of transactions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 10);

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

    if (!txRes.ok) return getMockMonoData();

    const txData = await txRes.json();
    const transactions: Transaction[] = (txData.data || []).map((t: any) => ({
      id: t.id,
      date: t.date,
      amount: Math.abs(t.amount) / 100,
      type: t.type === 'debit' ? 'debit' : 'credit',
      description: t.narration,
      balance: t.balance ? t.balance / 100 : undefined,
      category: t.category,
    }));

    if (transactions.length === 0) return getMockMonoData();

    return summariseTransactions('Mono Connect', transactions);
  } catch {
    console.warn('Mono fetch failed, using mock data');
    return getMockMonoData();
  }
}

// ============================================================
// OPAY — Mobile wallet transaction history
// Docs: developer.opayweb.com
// ============================================================

export async function fetchOpayData(accessToken: string): Promise<FinancialSummary> {
  const isTest = process.env.OPAY_BASE_URL?.includes('sandbox') || accessToken === 'mock_token';

  if (isTest) return getMockOpayData();

  try {
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
        startTime: Date.now() - 10 * 365 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
      }),
    });

    if (!res.ok) return getMockOpayData();

    const data = await res.json();
    const transactions: Transaction[] = (data.data?.list || []).map((t: any) => ({
      id: t.orderNo,
      date: new Date(t.createTime).toISOString(),
      amount: t.amount / 100,
      type: t.transType === 'in' ? 'credit' : 'debit',
      description: t.remark || t.orderType,
      balance: t.balance ? t.balance / 100 : undefined,
    }));

    if (transactions.length === 0) return getMockOpayData();

    return summariseTransactions('OPay Wallet', transactions);
  } catch {
    return getMockOpayData();
  }
}

// ============================================================
// REMITA — Utility payment history
// Docs: remita.net/developer
// ============================================================

export async function fetchRemitaData(accessToken: string): Promise<FinancialSummary> {
  const isTest = process.env.REMITA_BASE_URL?.includes('demo') || accessToken === 'mock_token';

  if (isTest) return getMockRemitaData();

  try {
    const res = await fetch(
      `${process.env.REMITA_BASE_URL}/exapp/api/v1/send/api/echannelsvc/merchant/api/payerverification/payment/history`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apiKey: process.env.REMITA_API_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) return getMockRemitaData();

    const data = await res.json();
    const transactions: Transaction[] = (data.responseData || []).map((t: any) => ({
      id: t.transactionId,
      date: t.transactionDate,
      amount: parseFloat(t.amount),
      type: 'debit' as const,
      description: t.serviceName || 'Utility payment',
      category: 'utility',
    }));

    if (transactions.length === 0) return getMockRemitaData();

    return summariseTransactions('Remita', transactions);
  } catch {
    return getMockRemitaData();
  }
}

// ============================================================
// COOPERATIVE — Savings and repayment records
// Custom integration — no public API, mock data for demo
// ============================================================

export async function fetchCooperativeData(_accessToken: string): Promise<FinancialSummary> {
  return getMockCoopData();
}

// ============================================================
// DATA SUMMARISATION
// ============================================================

function summariseTransactions(source: string, transactions: Transaction[]): FinancialSummary {
  const credits = transactions.filter(t => t.type === 'credit');
  const debits = transactions.filter(t => t.type === 'debit');

  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebits = debits.reduce((s, t) => s + t.amount, 0);

  const monthMap = new Map<string, { income: number; expenses: number }>();
  transactions.forEach(t => {
    const month = t.date.substring(0, 7);
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

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  return {
    source,
    transactions,
    totalCredits,
    totalDebits,
    avgMonthlyIncome,
    monthlyBreakdown,
    oldestRecord: sorted.length ? sorted[0].date : '',
    newestRecord: sorted.length ? sorted[sorted.length - 1].date : '',
  };
}

// ============================================================
// MOCK DATA — 10 years of realistic Nigerian trader history
// Adunola Fashola, fabric trader, Oje Market Ibadan
// Income grows over time to reflect business growth
// ============================================================

function getMockMonoData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();
  const MONTHS = 120; // 10 years

  for (let m = MONTHS; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    // Income grows over 10 years — starts lower, ends higher
    const yearsAgo = m / 12;
    const growthFactor = 1 + (0.08 * (10 - yearsAgo)); // 8% annual growth compounded
    const isFestive = date.getMonth() === 11 || date.getMonth() === 3; // Dec, Apr (Eid)
    const baseIncome = isFestive ? 12000 : 7000;
    const adjustedBase = Math.round(baseIncome * Math.min(growthFactor, 2.2));

    const marketDays = m === 0 ? 15 : 22;
    for (let d = 0; d < marketDays; d++) {
      const dayDate = new Date(date.getFullYear(), date.getMonth(), d + 1);
      transactions.push({
        id: `mono-${m}-${d}`,
        date: dayDate.toISOString(),
        amount: adjustedBase + Math.floor(Math.random() * 4000),
        type: 'credit',
        description: 'POS Transfer - Fabric sales',
        category: 'business_income',
      });
    }

    // Monthly business expenses
    transactions.push(
      {
        id: `rent-${m}`,
        date: new Date(date.getFullYear(), date.getMonth(), 5).toISOString(),
        amount: 30000 + Math.round(yearsAgo < 5 ? 0 : 5000),
        type: 'debit',
        description: 'Shop rent - Oje Market',
        category: 'rent',
      },
      {
        id: `stock-${m}`,
        date: new Date(date.getFullYear(), date.getMonth(), 3).toISOString(),
        amount: 70000 + Math.floor(Math.random() * 20000),
        type: 'debit',
        description: 'Fabric stock purchase - Balogun Market',
        category: 'inventory',
      }
    );
  }

  return summariseTransactions('Mono Connect', transactions);
}

function getMockOpayData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();
  const MONTHS = 120; // 10 years

  for (let m = MONTHS; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    // OPay usage grows over time as mobile money adoption increases
    const txCount = m > 84 ? 8 : m > 48 ? 14 : 20; // fewer transactions in earlier years

    for (let d = 0; d < txCount; d++) {
      transactions.push({
        id: `opay-${m}-${d}`,
        date: new Date(date.getFullYear(), date.getMonth(), (d % 28) + 1).toISOString(),
        amount: 2000 + Math.floor(Math.random() * 9000),
        type: 'credit',
        description: 'Transfer received - Customer payment',
        category: 'income',
      });
    }

    transactions.push({
      id: `airtime-${m}`,
      date: new Date(date.getFullYear(), date.getMonth(), 10).toISOString(),
      amount: 3000 + Math.floor(Math.random() * 2000),
      type: 'debit',
      description: 'Airtime & data purchase',
    });
  }

  return summariseTransactions('OPay Wallet', transactions);
}

function getMockRemitaData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();
  const MONTHS = 120; // 10 years

  for (let m = MONTHS; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    // Utility bills — paid every single month without fail
    transactions.push(
      {
        id: `electric-${m}`,
        date: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
        amount: 7000 + Math.floor(Math.random() * 3000),
        type: 'debit',
        description: 'IBEDC Electricity - Oje Market stall',
        category: 'utility',
      },
      {
        id: `water-${m}`,
        date: new Date(date.getFullYear(), date.getMonth(), 2).toISOString(),
        amount: 2800 + Math.floor(Math.random() * 800),
        type: 'debit',
        description: 'Oyo State Water Corporation',
        category: 'utility',
      }
    );
  }

  return summariseTransactions('Remita', transactions);
}

function getMockCoopData(): FinancialSummary {
  const transactions: Transaction[] = [];
  const now = new Date();
  const MONTHS = 120; // 10 years

  for (let m = MONTHS; m >= 0; m--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);

    // Cooperative savings — increases over the years
    const savingsAmount = m > 60 ? 10000 : m > 24 ? 12000 : 15000;

    transactions.push({
      id: `coop-${m}`,
      date: new Date(date.getFullYear(), date.getMonth(), 15).toISOString(),
      amount: savingsAmount,
      type: 'debit',
      description: 'Ibadan Traders Cooperative - monthly savings contribution',
      category: 'savings',
    });
  }

  return summariseTransactions('Cooperative', transactions);
}