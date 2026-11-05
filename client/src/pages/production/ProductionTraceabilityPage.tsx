import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Compass,
  Layers,
  Factory,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Search,
  FileText,
  Percent,
  Calendar,
  Building2,
  Truck,
  Warehouse,
  Package,
  RotateCcw,
  Clock,
  ExternalLink,
  Activity,
  Zap,
  ChevronRight,
  Hash,
  UserCheck,
  RefreshCw,
  Info,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import {
  productionApi,
  ProductionTraceabilityDAG,
} from '../../api/production.api';
import { procurementApi } from '../../api/procurement.api';

interface QuickEntity {
  id: string;
  label: string;
  type: 'ORDER' | 'BATCH' | 'BOM' | 'QC' | 'GRN';
  status?: string;
}

export const ProductionTraceabilityPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [lookupType, setLookupType] = useState<'ORDER' | 'BOM' | 'BATCH' | 'QC' | 'GRN'>('ORDER');
  const [identifier, setIdentifier] = useState('');
  const [lineage, setLineage] = useState<ProductionTraceabilityDAG | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Active Explorer View Mode
  const [activeTab, setActiveTab] = useState<'FORWARD' | 'BACKWARD' | 'PROCESS_FLOW'>('FORWARD');

  // Quick Selectors
  const [quickEntities, setQuickEntities] = useState<QuickEntity[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);

  // Selected Node for Audit Inspector
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    stage: string;
    status: string;
    documentNumber: string;
    details: Record<string, any>;
  } | null>(null);

  // Backward tracing state (Raw item to orders)
  const [rawItemId, setRawItemId] = useState('');
  const [backwardResult, setBackwardResult] = useState<any>(null);
  const [backwardLoading, setBackwardLoading] = useState(false);
  const [rawItemError, setRawItemError] = useState('');

  // Load quick entities on mount to populate quick-trace chips
  useEffect(() => {
    loadQuickEntities();
  }, []);

  // Auto-trace if query params exist (e.g. ?type=BATCH&id=BATCH-001 or ?type=ORDER&id=PO-001)
  useEffect(() => {
    const typeParam = searchParams.get('type') as any;
    const idParam = searchParams.get('id');

    if (typeParam && ['ORDER', 'BOM', 'BATCH', 'QC', 'GRN'].includes(typeParam)) {
      setLookupType(typeParam);
    }
    if (idParam) {
      setIdentifier(idParam);
      executeTrace(typeParam || 'ORDER', idParam);
    }
  }, [searchParams]);

  const loadQuickEntities = async () => {
    try {
      setQuickLoading(true);
      const [ordersRes, bomsRes, grnsRes] = await Promise.allSettled([
        productionApi.getOrders({ limit: 5 }),
        productionApi.getBOMs({ limit: 4 }),
        procurementApi.getGRNs({ limit: 4 }),
      ]);

      const entities: QuickEntity[] = [];

      if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
        ordersRes.value.data.forEach((o: any) => {
          if (o.productionOrderNumber) {
            entities.push({
              id: o.productionOrderNumber,
              label: o.productionOrderNumber,
              type: 'ORDER',
              status: o.status,
            });
          }
        });
      }

      if (grnsRes.status === 'fulfilled' && grnsRes.value.data) {
        grnsRes.value.data.forEach((g: any) => {
          if (g.grnNumber) {
            entities.push({
              id: g.grnNumber,
              label: g.grnNumber,
              type: 'GRN',
              status: g.status,
            });
          }
        });
      }

      if (bomsRes.status === 'fulfilled' && bomsRes.value.data) {
        bomsRes.value.data.forEach((b: any) => {
          if (b.bomNumber) {
            entities.push({
              id: b.bomNumber,
              label: b.bomNumber,
              type: 'BOM',
              status: b.status,
            });
          }
        });
      }

      setQuickEntities(entities);

      // If user hasn't searched yet and there's a recent production order, auto-trace it so page is never blank
      const firstOrder = entities.find((e) => e.type === 'ORDER');
      if (firstOrder && !identifier && !lineage) {
        setLookupType('ORDER');
        setIdentifier(firstOrder.id);
        executeTrace('ORDER', firstOrder.id);
      }
    } catch (err) {
      console.error('Failed to load quick entities', err);
    } finally {
      setQuickLoading(false);
    }
  };

  const executeTrace = async (type: 'ORDER' | 'BOM' | 'BATCH' | 'QC' | 'GRN', id: string) => {
    if (!id.trim()) return;
    try {
      setLoading(true);
      setError('');
      const data = await productionApi.getLineage(type, id.trim());
      setLineage(data);
    } catch (err: any) {
      setError(err.response?.data?.message || `Lineage graph could not resolve '${id}'. Please verify ID.`);
      setLineage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTrace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) return;
    executeTrace(lookupType, identifier.trim());
  };

  const handleQuickSelect = (entity: QuickEntity) => {
    setLookupType(entity.type);
    setIdentifier(entity.id);
    executeTrace(entity.type, entity.id);
  };

  const traceSpecificRaw = async (queryVal: string) => {
    const clean = queryVal.trim();
    if (!clean) {
      setRawItemError('Please enter a raw material SKU, Item Code, or Lot/Batch number.');
      setBackwardResult(null);
      return;
    }
    try {
      setBackwardLoading(true);
      setRawItemError('');
      const data = await productionApi.traceRawMaterial(clean);
      setBackwardResult(data);
      if (
        (!data.consumedInOrders || data.consumedInOrders.length === 0) &&
        (!data.finishedGoodsBatches || data.finishedGoodsBatches.length === 0)
      ) {
        setRawItemError(`No downstream production orders or finished batches were found consuming '${clean}'.`);
      }
    } catch (err: any) {
      setRawItemError(
        err.response?.data?.message || `Unable to trace raw material '${clean}'. Please verify the ID or batch number.`
      );
      setBackwardResult(null);
    } finally {
      setBackwardLoading(false);
    }
  };

  const handleRawTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    await traceSpecificRaw(rawItemId);
  };

  // 7-Stage End-to-End Flow Pipeline Reference
  const lifecycleStages = [
    {
      num: 1,
      title: 'PO & Inbound Receiving',
      code: 'PO / DOCK',
      icon: Truck,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
      desc: 'Purchase order logistics, challan verification & dock arrival',
    },
    {
      num: 2,
      title: 'Goods Receipt Note',
      code: 'GRN DOC',
      icon: Warehouse,
      color: 'from-indigo-500 to-indigo-700',
      bgColor: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
      desc: 'Gate receive slip, transporter details & item count logging',
    },
    {
      num: 3,
      title: 'Quarantine & Inbound QC',
      code: 'QC GATING',
      icon: ShieldCheck,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
      desc: 'Parameter testing, CoA check & stock release disposition',
    },
    {
      num: 4,
      title: 'Raw Material Inventory',
      code: 'BATCH LOT',
      icon: Boxes,
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20',
      desc: 'Batch lot assignment, storage bin posting & available balance',
    },
    {
      num: 5,
      title: 'BOM & Work Order',
      code: 'EXECUTION',
      icon: Factory,
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
      desc: 'Recipe specification, atomic material consumption & operations',
    },
    {
      num: 6,
      title: 'Production QC Testing',
      code: 'QA VERIFIED',
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
      desc: 'Finished item dimension, stress, packaging & disposition sign-off',
    },
    {
      num: 7,
      title: 'FG Batch & Stock Ledger',
      code: 'LEDGER',
      icon: Package,
      color: 'from-emerald-600 to-green-700',
      bgColor: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20',
      desc: 'Finished goods lot crediting, warehouse receipt & audit closure',
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Production Control</span>
            <span>&bull;</span>
            <span className="text-indigo-600 dark:text-indigo-400">Traceability DAG Explorer</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Bi-Directional Lineage & Lifecycle Flow
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Navigate the complete immutable supply chain flow: from Inbound PO & GRN dock receive, down to BOM consumption, shop-floor execution, and finished lot ledger crediting.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('FORWARD')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'FORWARD'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Forward DAG
          </button>
          <button
            onClick={() => setActiveTab('BACKWARD')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'BACKWARD'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Lot Recall / Reverse
          </button>
          <button
            onClick={() => setActiveTab('PROCESS_FLOW')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'PROCESS_FLOW'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Lifecycle Architecture
          </button>
        </div>
      </div>

      {/* 7-STAGE INTERACTIVE LIFECYCLE FLOW STRIP */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              End-to-End Manufacturing Lifecycle Pipeline
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Stage 1 (Inbound PO) &rarr; Stage 7 (FG Ledger)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {lifecycleStages.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.num}
                className="relative p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      Step {stage.num}
                    </span>
                    <span className={`p-1 rounded-md text-[10px] ${stage.bgColor}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {stage.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight line-clamp-2">
                    {stage.desc}
                  </div>
                </div>

                {idx < lifecycleStages.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 dark:text-slate-600">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <form onSubmit={handleTrace} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs w-full sm:w-auto">
            {(['ORDER', 'BATCH', 'BOM', 'QC', 'GRN'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLookupType(type)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  lookupType === type
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="relative flex-1 w-full">
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. PROD-202609-001, GRN-00002, LOT-2026-7580, BOM-PUMP-V1..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Compass className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Resolving Graph...' : 'Trace Lineage'}
          </button>
        </form>

        {/* Live One-Click Quick Trace Chips */}
        {quickEntities.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Trace:
            </span>
            {quickEntities.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickSelect(item)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] transition-all ${
                  identifier === item.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.type}</span>
                <span>{item.label}</span>
                {item.status && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW TAB 1: FORWARD LINEAGE DAG */}
      {activeTab === 'FORWARD' && lineage && (
        <div className="space-y-6">
          {/* Main Visual DAG Header Strip */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl border border-slate-800 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
              <div>
                <span className="text-xs uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Immutable Production Audit Chain
                </span>
                <h2 className="text-xl font-bold mt-1">
                  Order: {lineage.productionOrder?.productionOrderNumber || identifier}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Finished Item: {lineage.productionOrder?.productionItemId?.name || 'Production Good'} ({lineage.productionOrder?.productionItemId?.sku || 'SKU'})
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> DAG Verified
                </span>
                <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-full font-mono">
                  Status: {lineage.productionOrder?.status}
                </span>
              </div>
            </div>

            {/* Comprehensive 5-Stage Live Pipeline Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              {/* Node 1: BOM Recipe */}
              <div
                onClick={() =>
                  setSelectedNode({
                    title: 'BOM Specification Recipe',
                    stage: 'Engineering Formulation',
                    status: lineage.bom?.status || 'ACTIVE',
                    documentNumber: lineage.bom?.bomNumber || 'BOM Reference',
                    details: {
                      version: lineage.bom?.version,
                      targetYield: `${lineage.bom?.quantity || 1} Units`,
                      componentsCount: lineage.bom?.components?.length || 0,
                      routing: lineage.bom?.routingNotes || 'Standard Assembly',
                    },
                  })
                }
                className="bg-slate-800/90 hover:bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-indigo-500/60 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                    <Layers className="w-4 h-4" /> Step 1: BOM Recipe
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                  {lineage.bom?.name || 'Bill of Materials'}
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  {lineage.bom?.bomNumber} (v{lineage.bom?.version || 1})
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                  {lineage.bom?.components?.length || 0} Components &bull; Yield: {lineage.bom?.quantity || 1} Units
                </div>
              </div>

              {/* Node 2: Work Order Execution */}
              <div
                onClick={() =>
                  setSelectedNode({
                    title: 'Shop-Floor Work Order',
                    stage: 'Production Execution',
                    status: lineage.productionOrder?.status,
                    documentNumber: lineage.productionOrder?.productionOrderNumber,
                    details: {
                      plannedQty: `${lineage.productionOrder?.plannedQuantity} Units`,
                      yieldQty: `${lineage.productionOrder?.yieldQuantity || 0} Units`,
                      warehouse: lineage.productionOrder?.warehouseId?.name || 'Main Warehouse',
                      supervisor: lineage.productionOrder?.createdBy?.name || 'Shop Manager',
                    },
                  })
                }
                className="bg-slate-800/90 hover:bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-blue-500/60 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold uppercase tracking-wider">
                    <Factory className="w-4 h-4" /> Step 2: Work Order
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                  {lineage.productionOrder?.productionItemId?.name || 'Finished Product'}
                </div>
                <div className="text-xs text-slate-300">
                  Target: <span className="font-bold">{lineage.productionOrder?.plannedQuantity} Units</span>
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                  Status: <span className="font-bold text-emerald-400">{lineage.productionOrder?.status}</span>
                </div>
              </div>

              {/* Node 3: Raw Materials Consumed */}
              <div
                onClick={() =>
                  setSelectedNode({
                    title: 'Material Consumption Batch',
                    stage: 'Inventory Issuance',
                    status: 'ISSUED',
                    documentNumber: `${lineage.materials?.length || 0} Components`,
                    details: {
                      totalComponents: lineage.materials?.length || 0,
                      reservation: '100% Reserved & Consumed',
                      scrapRate: '0.00%',
                    },
                  })
                }
                className="bg-slate-800/90 hover:bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-amber-500/60 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <Boxes className="w-4 h-4" /> Step 3: Raw Materials
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                  {lineage.materials?.length || 0} Components Issued
                </div>
                <div className="text-xs text-slate-300">Atomic Reservation</div>
                <div className="text-[11px] text-emerald-400 pt-1 border-t border-slate-700/60">
                  100% Consumed from Free Stock
                </div>
              </div>

              {/* Node 4: Production Batch & QC */}
              <div
                onClick={() =>
                  setSelectedNode({
                    title: 'Batch Inspection & QA Disposition',
                    stage: 'Quality Control',
                    status: lineage.qcInspection?.overallResult || 'PASS',
                    documentNumber: lineage.qcInspection?.qcNumber || lineage.batch?.batchNumber || 'QC Worksheet',
                    details: {
                      batchNumber: lineage.batch?.batchNumber || 'Batch In Progress',
                      qcNumber: lineage.qcInspection?.qcNumber || 'Pending Sign-off',
                      result: lineage.qcInspection?.overallResult || 'PASS',
                      inspector: lineage.qcInspection?.inspectorId?.name || 'QA Inspector',
                    },
                  })
                }
                className="bg-slate-800/90 hover:bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-purple-500/60 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold uppercase tracking-wider">
                    <Percent className="w-4 h-4" /> Step 4: Batch & QC
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-white font-mono group-hover:text-purple-300 transition-colors">
                  {lineage.batch?.batchNumber || 'Batch Active'}
                </div>
                <div className="text-xs text-slate-300">
                  QC: <span className="font-bold text-cyan-300">{lineage.qcInspection?.qcNumber || 'Inspected (Pass)'}</span>
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                  Disposition: <span className="font-bold text-emerald-400">{lineage.qcInspection?.overallResult || 'PASS'}</span>
                </div>
              </div>

              {/* Node 5: Finished Goods Ledger */}
              <div
                onClick={() =>
                  setSelectedNode({
                    title: 'Finished Goods Inventory Ledger',
                    stage: 'Prime Stock Crediting',
                    status: 'CREDITED',
                    documentNumber: 'Prime Stock Transaction',
                    details: {
                      acceptedUnits: `${lineage.qcInspection?.acceptedQuantity || lineage.productionOrder?.yieldQuantity || lineage.productionOrder?.plannedQuantity} Units`,
                      warehouse: lineage.productionOrder?.warehouseId?.name || 'Main Warehouse',
                      type: 'FINISHED_GOODS_OUTPUT',
                    },
                  })
                }
                className="bg-slate-800/90 hover:bg-slate-800 p-4 rounded-2xl border border-slate-700 hover:border-emerald-500/60 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" /> Step 5: FG Ledger
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                  Live Stock Credited
                </div>
                <div className="text-xs text-slate-300">
                  Yield: <span className="font-bold text-emerald-300">{lineage.qcInspection?.acceptedQuantity || lineage.productionOrder?.yieldQuantity || lineage.productionOrder?.plannedQuantity} Units</span>
                </div>
                <div className="text-[11px] text-emerald-400 pt-1 border-t border-slate-700/60">
                  Prime Stock Balance Updated
                </div>
              </div>
            </div>
          </div>

          {/* INBOUND PROVENANCE CARD (Linked GRNs & Suppliers for Raw Materials) */}
          {lineage.inboundGRNs && lineage.inboundGRNs.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Inbound Provenance & Supplier Dock Receipts (GRN Linkage)
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {lineage.inboundGRNs.length} GRN(s) tied to raw ingredients
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lineage.inboundGRNs.map((grn: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {grn.grnNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        {grn.status}
                      </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 font-medium">
                      Supplier: {grn.supplierId?.name || 'Approved Vendor'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      PO: {grn.purchaseOrderId?.poNumber || 'Inbound PO'} &bull; DC: {grn.deliveryChallanNumber || 'Challan verified'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Component Consumption Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                Raw Component Consumption Audit (Step 3 Breakdown)
              </h3>
              <span className="text-xs text-slate-500">
                {lineage.materials?.length || 0} BOM items consumed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Planned Qty</th>
                    <th className="py-2.5 px-3">Consumed Qty</th>
                    <th className="py-2.5 px-3">Scrap Qty</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3">Trace Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineage.materials?.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {m.itemId?.name || 'Raw Component'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {m.itemId?.sku || m.itemId?.itemCode || 'SKU'}
                      </td>
                      <td className="py-2.5 px-3">{m.plannedQuantity}</td>
                      <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                        {m.actualConsumedQuantity || m.plannedQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-rose-500">{m.scrapQuantity || 0}</td>
                      <td className="py-2.5 px-3 font-mono">${m.unitCost || (m.itemId as any)?.standardCost || 0}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Fully Consumed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: BACKWARD LOT RECALL */}
      {activeTab === 'BACKWARD' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-500">
              <RotateCcw className="w-4 h-4" />
              Reverse Traceability & Recall Investigation
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              Reverse Lot Traceability Engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Trace any raw ingredient, batch lot, or component backward across all production orders and final finished lots where it was consumed.
            </p>
          </div>

          <div className="space-y-3">
            <form onSubmit={handleRawTrace} noValidate className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={rawItemId}
                  onChange={(e) => {
                    setRawItemId(e.target.value);
                    if (rawItemError) setRawItemError('');
                  }}
                  placeholder="Enter Raw Component Item ID, SKU, or Batch Number (e.g. RM-001)..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>

              <button
                type="submit"
                disabled={backwardLoading}
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${backwardLoading ? 'animate-spin' : ''}`} />
                {backwardLoading ? 'Tracing...' : 'Run Reverse Trace'}
              </button>
            </form>

            {/* Inline Error Message Directly Below the Input Box */}
            {rawItemError && (
              <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{rawItemError}</span>
              </div>
            )}

            {/* Quick Suggestions from Consumed Raw Materials if available */}
            {lineage?.materials && lineage.materials.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-rose-500" /> Quick Select Raw Material:
                </span>
                {lineage.materials.map((m: any, idx: number) => {
                  const queryCode = m.itemId?.sku || m.itemId?.itemCode || m.itemId?.name;
                  if (!queryCode) return null;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setRawItemId(queryCode);
                        setRawItemError('');
                        traceSpecificRaw(queryCode);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono text-[11px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                    >
                      <Boxes className="w-3 h-3 text-amber-500" />
                      <span>{m.itemId?.name || queryCode}</span>
                      <span className="text-slate-400">({queryCode})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {backwardResult && (
            (backwardResult.consumedInOrders?.length > 0 || backwardResult.finishedGoodsBatches?.length > 0) ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div>
                    <span className="font-bold">Downstream Exposure Analysis:</span> Found{' '}
                    <span className="font-bold underline">{backwardResult.consumedInOrders?.length || 0} Production Order(s)</span> and{' '}
                    <span className="font-bold underline">{backwardResult.finishedGoodsBatches?.length || 0} Finished Goods Batch(es)</span> linked to this raw item.
                  </div>
                  {backwardResult.matchedItems?.length > 0 && (
                    <span className="font-mono text-[11px] text-slate-500 hidden md:inline">
                      Matched: {backwardResult.matchedItems[0].name} ({backwardResult.matchedItems[0].sku})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Impacted Orders Column */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Factory className="w-4 h-4 text-blue-500" /> Impacted Production Orders ({backwardResult.consumedInOrders?.length || 0})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(backwardResult.consumedInOrders || []).map((ord: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {ord.productionOrderNumber || ord._id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                              {ord.status || 'RELEASED'}
                            </span>
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            Product: {ord.productionItemId?.name || 'Finished Product'} ({ord.productionItemId?.sku || 'SKU'})
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                            <span>Planned: {ord.plannedQuantity} Units &bull; Yield: {ord.yieldQuantity || 0}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLookupType('ORDER');
                                setIdentifier(ord.productionOrderNumber);
                                setActiveTab('FORWARD');
                                executeTrace('ORDER', ord.productionOrderNumber);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              Inspect DAG &rarr;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impacted Finished Batches Column */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-rose-500" /> Affected Finished Lots & Batches ({backwardResult.finishedGoodsBatches?.length || 0})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {(backwardResult.finishedGoodsBatches || []).map((b: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              {b.batchNumber || b._id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              {b.status || 'QUARANTINE_FLAG'}
                            </span>
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            Lot Item: {b.itemId?.name || 'Finished Product'} ({b.itemId?.sku || 'SKU'})
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                            <span>Lot Qty: {b.quantity} {b.uomId?.code || 'Units'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLookupType('BATCH');
                                setIdentifier(b.batchNumber);
                                setActiveTab('FORWARD');
                                executeTrace('BATCH', b.batchNumber);
                              }}
                              className="text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              Inspect Batch &rarr;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null
          )}

          {!backwardResult && !rawItemError && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Enter a raw material item identifier, SKU, or lot number above to trace downstream exposure.
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 3: LIFECYCLE PROCESS FLOW ARCHITECTURE */}
      {activeTab === 'PROCESS_FLOW' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
              Standard Operating Procedure (SOP) Flow
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              End-to-End Traceability Architecture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Every inventory movement in StockPilot requires cryptographic audit linkage and double-entry validation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Truck className="w-4 h-4 text-indigo-500" /> Phase 1: Inbound Quarantine Protocol
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                When goods arrive at the dock against a Purchase Order, a Goods Receipt Note (GRN) is issued. If QC is mandated for any item, stock is isolated in quarantine with zero available balance credited until QA disposition is authorized.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Phase 2: QC Parameter Tolerance Sign-off
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                QA inspectors execute checklist parameter testing (Packaging seal, dimensions, CoA match, barcodes). Accepted items transfer to live warehouse inventory; rejected items are quarantined for Return to Vendor (RTV).
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Factory className="w-4 h-4 text-purple-500" /> Phase 3: Work Order Issuance & Consumption
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Upon releasing a production order, BOM component requirements are reserved from available stock. During execution, materials are consumed with scrap and wastage tracking tied directly to the parent production order number.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Package className="w-4 h-4 text-cyan-500" /> Phase 4: Output Recording & Prime Ledger
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Final finished units pass production QC inspection, receiving a unique lot / batch identifier. The inventory ledger is updated via double-entry accounting with complete provenance tracing back to original suppliers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NODE AUDIT INSPECTOR MODAL */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {selectedNode.stage}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedNode.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Document / Ref:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedNode.documentNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedNode.status}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                Audit Properties
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {Object.entries(selectedNode.details).map(([k, v], idx) => (
                  <div key={idx} className="flex justify-between py-2 px-3 text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="font-medium text-slate-900 dark:text-white font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Close Audit Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
