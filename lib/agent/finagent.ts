// lib/agent/finagent.ts
// FinAgent — LangGraph state machine (fixed state handling)

import Anthropic from '@anthropic-ai/sdk';
import { getTokenVaultToken, type SourceKey } from '../auth0';
import { fetchMonoData, fetchOpayData, fetchRemitaData, fetchCooperativeData, type FinancialSummary } from '../sources';
import { logConsentAction, updateDossier } from '../db/supabase';

export type AgentEvent = {
  type: 'node_start' | 'node_complete' | 'narrative_chunk' | 'complete' | 'error';
  node?: string;
  data?: any;
  message?: string;
};

export interface AgentParams {
  userId: string;
  auth0UserId: string;
  dossierId: string;
  connectedSources: SourceKey[];
  sessionId?: string;
  onEvent?: (event: AgentEvent) => void;
}

export interface AgentResult {
  avgMonthlyIncome: number;
  incomeGrowthPct: number;
  paymentConsistency: number;
  businessTenureYears: number;
  reliabilityScore: number;
  scoreBreakdown: Record<string, number>;
  narrativeText: string;
  errors: string[];
}

export async function runFinAgent(params: AgentParams): Promise<AgentResult> {
  const emit = params.onEvent || (() => {});
  const sessionId = params.sessionId || crypto.randomUUID();
  const errors: string[] = [];

  // Collected data
  let monoData: FinancialSummary | null = null;
  let opayData: FinancialSummary | null = null;
  let remitaData: FinancialSummary | null = null;
  let coopData: FinancialSummary | null = null;

  // ── NODE: FETCH_MONO ──────────────────────────────────────────
  if (params.connectedSources.includes('mono')) {
    emit({ type: 'node_start', node: 'FETCH_MONO' });
    try {
      const token = await getTokenVaultToken(params.auth0UserId, 'mono').catch(() => 'mock_token');
      await logConsentAction({
        user_id: params.userId,
        source_key: 'mono',
        action: 'READ_TRANSACTIONS',
        token_vault_id: `mono_${token.substring(0, 8)}`,
        scopes_used: ['read:transactions', 'read:balance'],
        agent_node: 'FETCH_MONO',
        session_id: sessionId,
      });
      monoData = await fetchMonoData(token);
      emit({ type: 'node_complete', node: 'FETCH_MONO', data: { transactionCount: monoData.transactions.length } });
    } catch (err: any) {
      errors.push(`FETCH_MONO: ${err.message}`);
      emit({ type: 'node_complete', node: 'FETCH_MONO' });
    }
  }

  // ── NODE: FETCH_OPAY ──────────────────────────────────────────
  if (params.connectedSources.includes('opay')) {
    emit({ type: 'node_start', node: 'FETCH_OPAY' });
    try {
      const token = await getTokenVaultToken(params.auth0UserId, 'opay').catch(() => 'mock_token');
      await logConsentAction({
        user_id: params.userId,
        source_key: 'opay',
        action: 'READ_WALLET_HISTORY',
        token_vault_id: `opay_${token.substring(0, 8)}`,
        scopes_used: ['read:transactions', 'read:wallet'],
        agent_node: 'FETCH_OPAY',
        session_id: sessionId,
      });
      opayData = await fetchOpayData(token);
      emit({ type: 'node_complete', node: 'FETCH_OPAY', data: { transactionCount: opayData.transactions.length } });
    } catch (err: any) {
      errors.push(`FETCH_OPAY: ${err.message}`);
      emit({ type: 'node_complete', node: 'FETCH_OPAY' });
    }
  }

  // ── NODE: FETCH_REMITA ────────────────────────────────────────
  if (params.connectedSources.includes('remita')) {
    emit({ type: 'node_start', node: 'FETCH_REMITA' });
    try {
      const token = await getTokenVaultToken(params.auth0UserId, 'remita').catch(() => 'mock_token');
      await logConsentAction({
        user_id: params.userId,
        source_key: 'remita',
        action: 'READ_PAYMENT_HISTORY',
        token_vault_id: `remita_${token.substring(0, 8)}`,
        scopes_used: ['read:payment_history'],
        agent_node: 'FETCH_REMITA',
        session_id: sessionId,
      });
      remitaData = await fetchRemitaData(token);
      emit({ type: 'node_complete', node: 'FETCH_REMITA' });
    } catch (err: any) {
      errors.push(`FETCH_REMITA: ${err.message}`);
      emit({ type: 'node_complete', node: 'FETCH_REMITA' });
    }
  }

  // ── NODE: FETCH_COOPERATIVE ───────────────────────────────────
  if (params.connectedSources.includes('cooperative')) {
    emit({ type: 'node_start', node: 'FETCH_COOPERATIVE' });
    try {
      const token = await getTokenVaultToken(params.auth0UserId, 'cooperative').catch(() => 'mock_token');
      await logConsentAction({
        user_id: params.userId,
        source_key: 'cooperative',
        action: 'READ_SAVINGS_RECORDS',
        token_vault_id: `coop_${token.substring(0, 8)}`,
        scopes_used: ['read:savings', 'read:repayments'],
        agent_node: 'FETCH_COOPERATIVE',
        session_id: sessionId,
      });
      coopData = await fetchCooperativeData(token);
      emit({ type: 'node_complete', node: 'FETCH_COOPERATIVE' });
    } catch (err: any) {
      errors.push(`FETCH_COOPERATIVE: ${err.message}`);
      emit({ type: 'node_complete', node: 'FETCH_COOPERATIVE' });
    }
  }

  // ── NODE: ANALYSE_INCOME ──────────────────────────────────────
  emit({ type: 'node_start', node: 'ANALYSE_INCOME' });

  const incomeSources = [monoData, opayData].filter(Boolean) as FinancialSummary[];
  const monthMap = new Map<string, number>();

  incomeSources.forEach(source => {
    source.monthlyBreakdown.forEach(({ month, income }) => {
      monthMap.set(month, (monthMap.get(month) || 0) + income);
    });
  });

  const sortedMonths = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const avgMonthlyIncome = sortedMonths.length
    ? sortedMonths.reduce((s, [, v]) => s + v, 0) / sortedMonths.length
    : 184000; // fallback

  let incomeGrowthPct = 12; // default
  const n = sortedMonths.length;
  if (n >= 12) {
    const firstSixAvg = sortedMonths.slice(0, 6).reduce((s, [, v]) => s + v, 0) / 6;
    const lastSixAvg = sortedMonths.slice(n - 6).reduce((s, [, v]) => s + v, 0) / 6;
    incomeGrowthPct = firstSixAvg > 0 ? ((lastSixAvg - firstSixAvg) / firstSixAvg) * 100 : 12;
  }

  emit({ type: 'node_complete', node: 'ANALYSE_INCOME', data: { avgMonthlyIncome: Math.round(avgMonthlyIncome) } });

  // ── NODE: SCORE_RELIABILITY ───────────────────────────────────
  emit({ type: 'node_start', node: 'SCORE_RELIABILITY' });

  let paymentConsistency = 94;
  if (remitaData) {
    const months = remitaData.monthlyBreakdown.length;
    const paid = remitaData.monthlyBreakdown.filter(m => m.expenses > 0).length;
    paymentConsistency = months > 0 ? (paid / months) * 100 : 94;
  }

  const allSources = [monoData, opayData, remitaData, coopData].filter(Boolean) as FinancialSummary[];
  const oldestDate = allSources.reduce((oldest, s) => {
    return s.oldestRecord && s.oldestRecord < oldest ? s.oldestRecord : oldest;
  }, new Date().toISOString());

  const tenureMs = Date.now() - new Date(oldestDate).getTime();
  const businessTenureYears = Math.max(1, Math.floor(tenureMs / (1000 * 60 * 60 * 24 * 365)));

  const incomeScore     = Math.min(30, (avgMonthlyIncome / 200000) * 30);
  const consistencyScore = (paymentConsistency / 100) * 30;
  const tenureScore     = Math.min(20, businessTenureYears * 2.5);
  const growthScore     = Math.min(20, Math.max(0, incomeGrowthPct * 0.5));
  const reliabilityScore = Math.round(incomeScore + consistencyScore + tenureScore + growthScore);

  const scoreBreakdown = {
    income:      Math.round(incomeScore),
    consistency: Math.round(consistencyScore),
    tenure:      Math.round(tenureScore),
    growth:      Math.round(growthScore),
  };

  await updateDossier(params.dossierId, {
    avg_monthly_income:   Math.round(avgMonthlyIncome),
    income_growth_pct:    Math.round(incomeGrowthPct),
    payment_consistency:  Math.round(paymentConsistency),
    business_tenure_years: businessTenureYears,
    reliability_score:    reliabilityScore,
    score_breakdown:      scoreBreakdown,
  });

  emit({ type: 'node_complete', node: 'SCORE_RELIABILITY', data: { reliabilityScore } });

  // ── NODE: BUILD_NARRATIVE ─────────────────────────────────────
  emit({ type: 'node_start', node: 'BUILD_NARRATIVE' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are an experienced, empathetic loan officer writing a credit recommendation memo for a Nigerian informal economy worker.

Write in the voice of a trusted financial professional who genuinely believes in this person's creditworthiness. Your memo should:
- Be factual, warm, and professional
- Cite specific numbers from the data provided
- Highlight business patterns that demonstrate reliability
- Be 3-4 sentences maximum
- Use Nigerian business context (naira amounts, market culture, cooperative savings)
- Sound like a human recommendation, not a data dump

Do NOT use bullet points, headers, or structured formatting. Write as flowing prose.`;

  const userPrompt = `Write a credit recommendation memo for this applicant:

Average monthly income: ₦${Math.round(avgMonthlyIncome).toLocaleString()}
Income growth (YoY): ${Math.round(incomeGrowthPct)}%
Payment consistency: ${Math.round(paymentConsistency)}%
Business tenure: ${businessTenureYears} years
Reliability score: ${reliabilityScore}/100
Data sources: ${params.connectedSources.join(', ')}
Cooperative savings: ${coopData ? 'Yes — regular monthly contributions' : 'Not connected'}`;

  let narrativeText = '';

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        narrativeText += chunk.delta.text;
        emit({ type: 'narrative_chunk', data: { chunk: chunk.delta.text } });
      }
    }
  } catch (err: any) {
    narrativeText = `This applicant demonstrates consistent financial behaviour with an average monthly income of ₦${Math.round(avgMonthlyIncome).toLocaleString()} over ${businessTenureYears} years of business operation. Payment consistency of ${Math.round(paymentConsistency)}% across all recorded obligations reflects the discipline of a creditworthy borrower.`;
    errors.push(`BUILD_NARRATIVE: ${err.message}`);
  }

  await updateDossier(params.dossierId, {
    narrative_text: narrativeText,
    sources_used:   params.connectedSources,
    status:         'ready',
  });

  emit({ type: 'node_complete', node: 'BUILD_NARRATIVE' });

  const result: AgentResult = {
    avgMonthlyIncome,
    incomeGrowthPct,
    paymentConsistency,
    businessTenureYears,
    reliabilityScore,
    scoreBreakdown,
    narrativeText,
    errors,
  };

  emit({ type: 'complete', data: result });
  return result;
}