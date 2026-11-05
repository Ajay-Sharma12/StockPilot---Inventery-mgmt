import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Clock,
  ShieldCheck,
  Send,
  RefreshCw,
  Search,
  Filter,
  BrainCircuit,
  Database,
  ArrowRight,
  Terminal,
  Activity,
  Layers,
  FileText,
  AlertCircle,
  Boxes,
  Factory,
  Coins,
  Play,
  Check,
  ExternalLink,
  Zap,
  BarChart3,
  X,
} from 'lucide-react';
import { aiApi, AIInsightItem, AIAuditRecord, AISimulationResponse } from '../../api/ai.api';
import { productionApi } from '../../api/production.api';
import { Skeleton } from '../../components/ui/Skeleton';

export const AIInsightsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<'insights' | 'simulator' | 'copilot' | 'audit'>('insights');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  // Action Execution State
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [actionSuccessModal, setActionSuccessModal] = useState<{
    title: string;
    message: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);

  // Operations Copilot State
  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; references?: string[] }>
  >([
    {
      role: 'assistant',
      text: 'Hello! I am StockPilot Operations Copilot. I continuously analyze multi-tenant inventory velocity, calculate buffer runway days, detect supplier defect trends, and monitor shop-floor scrap variances. How can I assist your operational decisions today?',
      references: ['Centralized Inventory Ledger', 'BOM DAG Engine', 'Work Order Execution Pipeline'],
    },
  ]);

  // Production Demand Simulator State
  const [simSelectedBOM, setSimSelectedBOM] = useState<string>('');
  const [simQuantity, setSimQuantity] = useState<number>(100);
  const [simResult, setSimResult] = useState<AISimulationResponse | null>(null);

  // Queries
  const {
    data: insightsData,
    isLoading: isLoadingInsights,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => aiApi.getInsights(),
    refetchInterval: 60000,
  });

  const { data: auditLogs, isLoading: isLoadingAudits } = useQuery({
    queryKey: ['ai-audits'],
    queryFn: () => aiApi.getAuditLogs(),
    enabled: activeTab === 'audit',
  });

  const { data: bomsData } = useQuery({
    queryKey: ['boms-list'],
    queryFn: () => productionApi.getBOMs({ limit: 50 }),
    enabled: activeTab === 'simulator',
  });

  // Copilot Mutation
  const chatMutation = useMutation({
    mutationFn: (prompt: string) => aiApi.askAssistant(prompt),
    onSuccess: (response, variables) => {
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', text: variables },
        { role: 'assistant', text: response.answer, references: response.references },
      ]);
      setChatPrompt('');
      queryClient.invalidateQueries({ queryKey: ['ai-audits'] });
    },
    onError: (err: any) => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `An error occurred while evaluating operational context: ${
            err?.response?.data?.message || err.message
          }`,
        },
      ]);
    },
  });

  // Action Execution Mutation (1-Click Auto PO / Buffer Adjust)
  const actionMutation = useMutation({
    mutationFn: ({ actionType, payload }: { actionType: string; payload: Record<string, any> }) =>
      aiApi.executeAction(actionType, payload),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audits'] });
      if (vars.actionType === 'GENERATE_PO') {
        setActionSuccessModal({
          title: 'Draft Purchase Order Created',
          message: res.message || 'Draft Purchase Order created successfully in Procurement.',
          linkUrl: '/purchase/orders',
          linkLabel: 'View Purchase Orders',
        });
      } else {
        setActionSuccessModal({
          title: 'Action Executed Successfully',
          message: res.message || 'Operational parameter successfully updated.',
        });
      }
    },
    onError: (err: any) => {
      alert(`Action could not be executed: ${err?.response?.data?.message || err.message}`);
    },
    onSettled: () => {
      setExecutingActionId(null);
    },
  });

  // Demand Simulator Mutation
  const simulationMutation = useMutation({
    mutationFn: ({ finishedItemId, targetQuantity }: { finishedItemId: string; targetQuantity: number }) =>
      aiApi.simulateDemand(finishedItemId, targetQuantity),
    onSuccess: (res) => {
      setSimResult(res);
      queryClient.invalidateQueries({ queryKey: ['ai-audits'] });
    },
    onError: (err: any) => {
      alert(`Simulation failed: ${err?.response?.data?.message || err.message}`);
    },
  });

  const handleSendPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatPrompt.trim() || chatMutation.isPending) return;
    const prompt = chatPrompt.trim();
    chatMutation.mutate(prompt);
  };

  const handleRunSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simSelectedBOM) {
      alert('Please select a finished item recipe first.');
      return;
    }
    simulationMutation.mutate({
      finishedItemId: simSelectedBOM,
      targetQuantity: Number(simQuantity) || 1,
    });
  };

  const handleTriggerAction = (insight: AIInsightItem) => {
    if (!insight.actionType || !insight.actionPayload) return;
    setExecutingActionId(insight.id);
    actionMutation.mutate({
      actionType: insight.actionType,
      payload: insight.actionPayload,
    });
  };

  // Filter insights
  const filteredInsights = (insightsData?.insights || []).filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) return false;
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> Critical Priority
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Warning Notice
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="w-3 h-3" /> Informational
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'REPLENISHMENT':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'DEAD_STOCK':
        return <TrendingDown className="w-4 h-4 text-amber-400" />;
      case 'SUPPLIER_RISK':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'PRODUCTION_BOTTLENECK':
        return <Activity className="w-4 h-4 text-purple-400" />;
      default:
        return <BrainCircuit className="w-4 h-4 text-cyan-400" />;
    }
  };

  const kpis = insightsData?.kpiSummary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-slate-900 border border-purple-800/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Operational AI & Predictive Intelligence
              </h1>
            </div>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
              Deterministic shortage runway forecasting, automated supplier risk scoring, scrap anomaly detection, and 1-click corrective procurement actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Tenant Isolation: <strong className="text-emerald-400 font-semibold">Strict ABAC</strong>
              </span>
            </div>
            <button
              onClick={() => refetchInsights()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition border border-purple-400/30 shadow-lg shadow-purple-900/40 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInsights ? 'animate-spin' : ''}`} />
              <span>Recalculate Signals</span>
            </button>
          </div>
        </div>

        {/* METADATA STRIP */}
        {insightsData?.metadata && (
          <div className="mt-6 pt-4 border-t border-purple-800/30 flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Entities Evaluated:{' '}
                <span className="text-slate-200 font-semibold">
                  {insightsData.metadata.analyzedEntitiesCount} items, vendors & orders
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Last Model Run:{' '}
                <span className="text-slate-200 font-semibold">
                  {new Date(insightsData.metadata.generatedAt).toLocaleTimeString()}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Scope: <span className="text-slate-200 font-semibold">{insightsData.metadata.dataScope?.join(', ')}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* KPI 1: Health Score */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Health Index</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {kpis?.healthScore ?? 92}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
            <Check className="w-3 h-3" /> Operational Baseline
          </div>
        </div>

        {/* KPI 2: Critical Alerts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Critical Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {kpis?.criticalAlertsCount ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">Require immediate intervention</div>
        </div>

        {/* KPI 3: Stockout Runway < 7 Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Runway &lt; 7 Days</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-amber-500">
              {kpis?.itemsUnderSevenDaysRunway ?? 0} Items
            </span>
          </div>
          <div className="text-[11px] text-slate-500">Imminent stockout trajectory</div>
        </div>

        {/* KPI 4: Trapped Capital */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Trapped Capital</span>
            <Coins className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              ${(kpis?.totalCapitalTrapped || 0).toLocaleString()}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">Dead inventory 60+ days</div>
        </div>

        {/* KPI 5: Line Bottlenecks */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Line Bottlenecks</span>
            <Activity className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {kpis?.activeProductionBottlenecks ?? 0} Orders
            </span>
          </div>
          <div className="text-[11px] text-slate-500">Excess scrap / paused runs</div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'insights'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Predictive Signals & Insights</span>
          {insightsData?.insights?.length ? (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono">
              {insightsData.insights.length}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'simulator'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Production Demand Simulator</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            NEW
          </span>
        </button>

        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'copilot'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Operations Copilot</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'audit'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>AI Compliance & Audit</span>
        </button>
      </div>

      {/* TAB 1: OPERATIONAL SIGNALS & INSIGHTS */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* FILTER BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Category:
              </span>
              {['ALL', 'REPLENISHMENT', 'DEAD_STOCK', 'SUPPLIER_RISK', 'PRODUCTION_BOTTLENECK'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-2">Severity:</span>
              {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    selectedSeverity === sev
                      ? 'bg-slate-800 text-white dark:bg-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* INSIGHTS CARDS GRID */}
          {isLoadingInsights ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="w-24 h-5 rounded bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="w-16 h-4 bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <Skeleton className="w-48 h-5 bg-slate-200 dark:bg-slate-800" />
                  <Skeleton className="w-full h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                All Supply Chains Stable
              </h3>
              <p className="text-sm mt-1 max-w-md mx-auto">
                No critical anomalies or buffer stockout alerts detected within current filter criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredInsights.map((insight: AIInsightItem) => (
                <div
                  key={insight.id}
                  className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-400/50 dark:hover:border-purple-600/50 p-5 transition flex flex-col justify-between shadow-xs hover:shadow-md space-y-4"
                >
                  <div>
                    {/* Header: Category + Title + Severity */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {getCategoryIcon(insight.category)}
                        </span>
                        <div>
                          <span className="text-[10px] font-mono font-bold tracking-wide text-purple-600 dark:text-purple-400 uppercase">
                            {insight.category.replace('_', ' ')}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                            {insight.title}
                          </h3>
                        </div>
                      </div>
                      <div>{getSeverityBadge(insight.severity)}</div>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                      {insight.summary}
                    </p>

                    {/* Rich Metrics Strip */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs mb-3">
                      <div>
                        <span className="text-slate-500 block mb-0.5 font-medium">Estimated Impact</span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{insight.impact}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5 font-medium">Confidence Score</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-purple-600 rounded-full"
                              style={{ width: `${Math.round(insight.confidenceScore * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                            {Math.round(insight.confidenceScore * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Context Specific Badges */}
                    {insight.metrics && (
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        {insight.metrics.daysRunway !== undefined && (
                          <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] flex items-center gap-1 ${
                            insight.metrics.daysRunway <= 3
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-900'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            Runway: {insight.metrics.daysRunway} Days Left
                          </span>
                        )}
                        {insight.metrics.burnRatePerDay !== undefined && (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                            Burn: {insight.metrics.burnRatePerDay} Units/Day
                          </span>
                        )}
                        {insight.metrics.capitalTrapped !== undefined && (
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 font-mono font-bold text-[11px]">
                            Trapped: ${insight.metrics.capitalTrapped.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ACTION FOOTER */}
                  <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 max-w-xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span className="truncate">{insight.recommendedAction}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 1-Click Action Button */}
                      {insight.actionType && insight.actionPayload && (
                        <button
                          type="button"
                          onClick={() => handleTriggerAction(insight)}
                          disabled={executingActionId === insight.id}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <Zap className={`w-3.5 h-3.5 ${executingActionId === insight.id ? 'animate-spin' : ''}`} />
                          <span>{executingActionId === insight.id ? 'Executing...' : (insight.actionLabel || 'Execute Action')}</span>
                        </button>
                      )}

                      {/* Investigate in Copilot */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('copilot');
                          setChatPrompt(
                            `Analyze root causes for "${insight.title}" and formulate execution steps for: "${insight.recommendedAction}".`
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHAT-IF PRODUCTION DEMAND SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                <BarChart3 className="w-4 h-4" />
                What-If Scenario Simulator
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                Production Demand & Capacity Simulation Engine
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Simulate potential customer orders or surges. Test live component availability, identify bottlenecks, and calculate exact shortfall procurement budgets.
              </p>
            </div>
          </div>

          <form onSubmit={handleRunSimulation} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Target Finished Product (BOM Recipe)
              </label>
              <select
                value={simSelectedBOM}
                onChange={(e) => setSimSelectedBOM(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Select Recipe / Finished Good --</option>
                {(bomsData?.data || []).map((bom: any) => (
                  <option key={bom._id} value={bom.finishedItemId?._id || bom.finishedItemId}>
                    {bom.name} ({bom.bomNumber}) - Yield: {bom.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Hypothetical Target Batch Size (Units)
              </label>
              <input
                type="number"
                min="1"
                required
                value={simQuantity}
                onChange={(e) => setSimQuantity(Number(e.target.value))}
                placeholder="e.g. 250 units"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={simulationMutation.isPending}
                className="w-full px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${simulationMutation.isPending ? 'animate-spin' : ''}`} />
                {simulationMutation.isPending ? 'Simulating Capacity...' : 'Simulate Feasibility'}
              </button>
            </div>
          </form>

          {/* SIMULATION RESULTS */}
          {simResult && (
            <div className="space-y-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              {/* Feasibility Banner */}
              <div
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  simResult.feasible
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {simResult.feasible ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    )}
                    <span>
                      {simResult.feasible
                        ? '100% FEASIBLE PRODUCTION RUN'
                        : 'MATERIAL SHORTAGE DETECTED (IMPASSE)'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 max-w-2xl leading-relaxed">{simResult.summary}</p>
                </div>

                {!simResult.feasible && (
                  <div className="text-right shrink-0">
                    <span className="text-xs text-rose-600 dark:text-rose-400 block font-semibold">
                      Required Procurement Budget
                    </span>
                    <span className="text-xl font-mono font-black text-rose-700 dark:text-rose-300">
                      ${simResult.totalEstimatedShortageCost.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Component Availability Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Component Item</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Required Qty</th>
                      <th className="py-3 px-4">Available Free Stock</th>
                      <th className="py-3 px-4">Shortfall Deficit</th>
                      <th className="py-3 px-4">Estimated PO Cost</th>
                      <th className="py-3 px-4">Feasibility Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {simResult.components.map((comp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {comp.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                          {comp.sku}
                        </td>
                        <td className="py-3 px-4 font-semibold">{comp.requiredQuantity} Units</td>
                        <td className="py-3 px-4">{comp.availableStock} Units</td>
                        <td className="py-3 px-4 font-bold">
                          {comp.shortage > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              -{comp.shortage} Units
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          ${comp.estimatedCost > 0 ? comp.estimatedCost.toLocaleString() : '0.00'}
                        </td>
                        <td className="py-3 px-4">
                          {comp.isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Sufficient
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="w-3.5 h-3.5" /> Shortage
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OPERATIONS COPILOT */}
      {activeTab === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 flex flex-col h-[650px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
            {/* Copilot Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    StockPilot Operations Copilot
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Context-grounded reasoning over live multi-tenant inventory & work order ledgers
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Ledger Bound
              </span>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chatHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3.5 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {item.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed ${
                      item.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 rounded-bl-none shadow-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{item.text}</div>
                    {item.references && item.references.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                          <FileText className="w-3 h-3 text-purple-500" /> Evidence:
                        </span>
                        {item.references.map((ref, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[11px] font-mono border border-slate-200 dark:border-slate-700"
                          >
                            {ref}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 font-bold text-xs">
                      YOU
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3.5 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-600 shrink-0 animate-pulse">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
                    <span>Evaluating inventory balances, safety buffers, and work order DAGs...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendPrompt} className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask about raw material shortages, work orders, or supplier defect trends..."
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                disabled={chatMutation.isPending}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={!chatPrompt.trim() || chatMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Quick Prompts Panel */}
          <div className="space-y-4">
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Quick Operations Inquiries
              </h4>
              <div className="space-y-2">
                {[
                  'What raw materials are currently below safety reorder stock?',
                  'Analyze active production work orders and scrap rates',
                  'Summarize high-defect suppliers from recent dock QC inspections',
                  'Give me an operational executive health report',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setChatPrompt(prompt);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50 dark:bg-slate-800/40 dark:hover:bg-purple-600/20 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 transition leading-snug cursor-pointer"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2 shadow-xs">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Enterprise Guardrails
              </div>
              <p>• Prompts are strictly scoped to your authorized tenant boundary.</p>
              <p>• Every inference call is immutably logged for audit compliance.</p>
              <p>• Zero data leakage to public third-party models.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI COMPLIANCE & AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Immutable AI Access & Action Audit Trail
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">SOC2 / ISO 27001 Ready</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Feature</th>
                  <th className="p-3.5">Provider / Model</th>
                  <th className="p-3.5">Request Type</th>
                  <th className="p-3.5">Data Scope</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {isLoadingAudits ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                      Loading compliance audit logs...
                    </td>
                  </tr>
                ) : !auditLogs || auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No AI audit records logged yet. Run a prompt in Operations Copilot to generate audit events.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: AIAuditRecord) => (
                    <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                        {log.feature}
                      </td>
                      <td className="p-3.5 font-mono text-purple-600 dark:text-purple-400">
                        {log.provider}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {log.requestType}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1">
                          {log.dataScope?.map((scope, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {log.responseStatus || 'SUCCESS'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTION SUCCESS NOTIFICATION MODAL */}
      {actionSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {actionSuccessModal.title}
                </h3>
              </div>
              <button
                onClick={() => setActionSuccessModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {actionSuccessModal.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              {actionSuccessModal.linkUrl && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(actionSuccessModal.linkUrl!);
                    setActionSuccessModal(null);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{actionSuccessModal.linkLabel || 'View Record'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setActionSuccessModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
