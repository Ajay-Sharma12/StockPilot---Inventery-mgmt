import React, { useState, useEffect } from 'react';
import {
  Compass,
  Layers,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Boxes,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productionApi, BOM, MaterialRequirementPlan } from '../../api/production.api';
import { warehouseApi, Warehouse as IWarehouse } from '../../api/warehouse.api';
import { Select } from '../../components/ui/Select';

export const ProductionPlanningPage: React.FC = () => {
  const navigate = useNavigate();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedBomId, setSelectedBomId] = useState('');
  const [plannedQty, setPlannedQty] = useState<number>(20);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  // Calculation Result
  const [calcPlan, setCalcPlan] = useState<MaterialRequirementPlan | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoading(true);
      const [bomsRes, whRes] = await Promise.all([
        productionApi.getBOMs(),
        warehouseApi.getWarehouses(),
      ]);

      const allBoms = Array.isArray(bomsRes) ? bomsRes : (bomsRes?.data || []);
      const whs = whRes || [];

      setBoms(allBoms);
      setWarehouses(whs);

      const defaultBom = allBoms.find((b: any) => b.status === 'ACTIVE') || allBoms[0];
      if (defaultBom) setSelectedBomId(defaultBom._id);
      if (whs.length > 0) setSelectedWarehouseId(whs[0]._id);
    } catch (err) {
      console.error('Failed to load MRP prerequisites', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedBomId || plannedQty <= 0) return;

    try {
      setCalculating(true);
      setCalcError('');
      const result = await productionApi.calculateMRP({
        bomId: selectedBomId,
        plannedQuantity: Number(plannedQty),
        warehouseId: selectedWarehouseId || undefined,
      });
      setCalcPlan(result);
    } catch (err: any) {
      setCalcError(err.response?.data?.message || 'Failed to calculate material requirements');
      setCalcPlan(null);
    } finally {
      setCalculating(false);
    }
  };

  // Run calculation when BOM or warehouse changes
  useEffect(() => {
    if (selectedBomId) {
      handleCalculate();
    }
  }, [selectedBomId, selectedWarehouseId]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Production Control</span>
          <span>&bull;</span>
          <span className="text-indigo-600 dark:text-indigo-400">Planning & MRP</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
          Material Requirements Planning (MRP) Engine
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Compute gross/net component requirements with scrap factors and simulate warehouse inventory availability
        </p>
      </div>

      {/* Control Input Console */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleCalculate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Active BOM Recipe *
            </label>
            <Select
              value={selectedBomId}
              onChange={(e) => setSelectedBomId(e.target.value)}
              placeholder="Select Active BOM Recipe..."
              searchable
              variant="indigo"
              options={boms.map((b) => ({
                value: b._id,
                label: b.name,
                sublabel: `${b.bomNumber} - v${b.version}`,
                badge: b.status,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Planned Output Quantity *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={plannedQty}
              onChange={(e) => setPlannedQty(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Warehouse Facility
            </label>
            <Select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              placeholder="Select Warehouse..."
              searchable
              variant="indigo"
              options={warehouses.map((w) => ({
                value: w._id,
                label: w.name,
                sublabel: w.code,
                badge: w.type || undefined,
              }))}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={calculating || !selectedBomId}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Compass className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
              {calculating ? 'Calculating...' : 'Run MRP Simulation'}
            </button>
          </div>
        </form>
      </div>

      {calcError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{calcError}</span>
        </div>
      )}

      {/* MRP Simulation Results Display */}
      {calcPlan && (
        <div className="space-y-6">
          {/* Feasibility Banner */}
          <div
            className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              calcPlan.feasible
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  calcPlan.feasible
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                }`}
              >
                {calcPlan.feasible ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {calcPlan.feasible
                    ? 'Production Run Feasible: 100% Stock Available'
                    : 'Stock Shortages Detected: Inbound Requisitions Needed'}
                </h3>
                <p className="text-xs opacity-80">
                  Targeting {calcPlan.plannedQuantity} units of {calcPlan.finishedItemName} ({calcPlan.bomNumber} v
                  {calcPlan.bomVersion})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-xs uppercase tracking-wider opacity-70 font-semibold">
                  Est. Material Cost
                </span>
                <span className="text-xl font-extrabold">${calcPlan.totalEstimatedMaterialCost.toLocaleString()}</span>
              </div>
              <button
                onClick={() => {
                  navigate('/production/orders', {
                    state: {
                      prefillBomId: calcPlan.bomId,
                      prefillPlannedQty: calcPlan.plannedQuantity,
                      prefillWarehouseId: selectedWarehouseId,
                    },
                  });
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Draft Work Order
              </button>
            </div>
          </div>

          {/* Component Requirements Breakdown Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Component Gross Requirements & Warehouse Balance Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Formula: Gross Required = Planned Qty &times; Base BOM Qty &times; (1 + Scrap %)
                </p>
              </div>
              <span className="text-xs text-slate-400">{calcPlan.components.length} components calculated</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Component Item</th>
                    <th className="py-3 px-4">Base Qty</th>
                    <th className="py-3 px-4">Scrap %</th>
                    <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400">Gross Required</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Reserved</th>
                    <th className="py-3 px-4">Available Free</th>
                    <th className="py-3 px-4">Shortfall</th>
                    <th className="py-3 px-4 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {calcPlan.components.map((comp) => {
                    const hasShortage = comp.shortfall > 0;
                    return (
                      <tr
                        key={comp.itemId}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          hasShortage ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{comp.name}</div>
                          <div className="text-xs font-mono text-slate-500">{comp.sku}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {comp.baseQuantity} {comp.uomCode || 'PCS'}
                        </td>
                        <td className="py-3.5 px-4 text-amber-600 dark:text-amber-400 font-semibold">
                          {comp.scrapPercentage}%
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                          {comp.grossRequiredQuantity} {comp.uomCode || 'PCS'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{comp.currentStock}</td>
                        <td className="py-3.5 px-4 text-slate-500">{comp.reservedStock}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {comp.availableStock}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasShortage ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                              <AlertTriangle className="w-3 h-3" />
                              -{comp.shortfall}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-900 dark:text-white">
                          ${comp.estimatedCost.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
