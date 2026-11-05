import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { itemApi } from '../../api/item.api';
import { masterDataApi } from '../../api/masterData.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';

export const StockAdjustmentsPage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const { success, error: toastError } = useToast();
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Modal form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [adjustedQuantity, setAdjustedQuantity] = useState<number>(0);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [adjRes, whRes, itemsRes, reasonsRes] = await Promise.all([
        inventoryApi.getAdjustments({ limit: 50 }),
        warehouseApi.getWarehouses(),
        itemApi.getItems({ limit: 100 }),
        masterDataApi.getStockAdjustmentReasons(),
      ]);

      let whs = whRes || [];
      let rsn = reasonsRes || [];
      if (whs.length === 0 || rsn.length === 0) {
        try {
          await masterDataApi.initializeStarterData();
          [whs, rsn] = await Promise.all([
            warehouseApi.getWarehouses(),
            masterDataApi.getStockAdjustmentReasons(),
          ]);
        } catch (initErr) {
          console.warn('Auto starter data initialization skipped:', initErr);
        }
      }

      setAdjustments(adjRes.data || []);
      setWarehouses(whs || []);
      setItemsList(itemsRes.data || []);
      setReasons(rsn || []);
    } catch (err) {
      console.error('Failed to load adjustments', err);
    } finally {
      setLoading(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!selectedWarehouseId) errors.warehouseId = 'Please select a warehouse';
    if (!selectedItemId) errors.itemId = 'Please select an item';
    if (adjustedQuantity === undefined || adjustedQuantity === null || isNaN(adjustedQuantity) || adjustedQuantity < 0) {
      errors.adjustedQuantity = 'Please enter a valid physical quantity (0 or greater)';
    }
    if (!selectedReasonId) errors.reasonId = 'Please select an adjustment reason';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      await inventoryApi.createAdjustment({
        warehouseId: selectedWarehouseId,
        items: [
          {
            itemId: selectedItemId,
            adjustedQuantity: Number(adjustedQuantity),
            reasonId: selectedReasonId || undefined,
            remarks,
          },
        ],
        reason: remarks || 'Manual stock adjustment',
      });

      setIsCreateModalOpen(false);
      setSelectedWarehouseId('');
      setSelectedItemId('');
      setAdjustedQuantity(0);
      setSelectedReasonId('');
      setRemarks('');
      setFormErrors({});
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Adjustment creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await inventoryApi.approveAdjustment(id);
      success('Stock adjustment approved successfully');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || 'Failed to approve adjustment');
    } finally {
      setActionLoading(false);
    }
  };

  const canAdjust = isSuperAdmin || can('inventory:adjust');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-7 h-7 text-emerald-400" />
            Stock Adjustments
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Controlled inventory balance corrections with reason codes, discrepancy calculation, and approval sign-off
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="text-xs border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {canAdjust && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError('');
                setIsCreateModalOpen(true);
              }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Adjustment
            </Button>
          )}
        </div>
      </div>

      {/* Adjustments Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Adjustment #</th>
                  <th className="py-3 px-4 font-semibold">Warehouse</th>
                  <th className="py-3 px-4 font-semibold">Item (SKU)</th>
                  <th className="py-3 px-4 font-semibold text-right">System Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Adjusted Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Difference</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      {loading ? 'Loading adjustments...' : 'No stock adjustments recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  adjustments.map((adj) => (
                    <tr key={adj._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {adj.adjustmentNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {adj.warehouseId?.code}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {adj.items?.map((i: any, idx: number) => (
                          <div key={idx}>{i.itemId?.sku} - {i.itemId?.name}</div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-right">
                        {adj.items?.[0]?.currentQuantity ?? 0}
                      </td>
                      <td className="py-3 px-4 font-bold text-white font-mono text-right">
                        {adj.items?.[0]?.adjustedQuantity ?? 0}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-right">
                        {adj.items?.[0]?.difference > 0 ? (
                          <span className="text-emerald-400 flex items-center justify-end gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            +{adj.items[0].difference}
                          </span>
                        ) : adj.items?.[0]?.difference < 0 ? (
                          <span className="text-rose-400 flex items-center justify-end gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            {adj.items[0].difference}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {adj.items?.[0]?.reasonId?.name || adj.reason || 'Manual Correction'}
                      </td>
                      <td className="py-3 px-4">
                        {adj.status === 'COMPLETED' ? (
                          <Badge variant="success">Posted to Ledger</Badge>
                        ) : (
                          <Badge variant="warning">{adj.status}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {adj.status !== 'COMPLETED' && canAdjust && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApprove(adj._id)}
                            isLoading={actionLoading}
                            className="text-[11px] h-7 bg-emerald-600 hover:bg-emerald-500"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                        )}
                        {adj.status === 'COMPLETED' && (
                          <span className="text-xs text-slate-500">Approved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Adjustment Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormErrors({});
        }}
        title="Create Stock Adjustment Request"
        description="Records physical discrepancy and prepares ledger correction upon approval"
      >
        <form onSubmit={handleCreateAdjustment} noValidate className="space-y-4 text-xs">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          <Select
            label="Warehouse *"
            value={selectedWarehouseId}
            onChange={(e) => {
              setSelectedWarehouseId(e.target.value);
              if (formErrors.warehouseId) setFormErrors((prev) => ({ ...prev, warehouseId: '' }));
            }}
            placeholder="Select facility..."
            options={warehouses.map((wh) => ({
              value: wh._id,
              label: `${wh.code} - ${wh.name}`,
            }))}
            error={formErrors.warehouseId}
          />

          {itemsList.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>No items registered in your catalog yet.</span>
              <a href="/inventory/items" className="font-semibold text-emerald-400 hover:underline">
                Register Items &rarr;
              </a>
            </div>
          ) : (
            <Select
              label="Item (SKU) *"
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                if (formErrors.itemId) setFormErrors((prev) => ({ ...prev, itemId: '' }));
              }}
              placeholder="Select SKU..."
              options={itemsList.map((item) => ({
                value: item._id,
                label: `${item.sku} - ${item.name}`,
              }))}
              error={formErrors.itemId}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="New Physical Quantity *"
              type="number"
              min="0"
              step="any"
              value={adjustedQuantity}
              onChange={(e) => {
                setAdjustedQuantity(Number(e.target.value));
                if (formErrors.adjustedQuantity) setFormErrors((prev) => ({ ...prev, adjustedQuantity: '' }));
              }}
              error={formErrors.adjustedQuantity}
            />
            <Select
              label="Adjustment Reason *"
              value={selectedReasonId}
              onChange={(e) => {
                setSelectedReasonId(e.target.value);
                if (formErrors.reasonId) setFormErrors((prev) => ({ ...prev, reasonId: '' }));
              }}
              placeholder="Select reason..."
              options={reasons.map((r) => ({
                value: r._id,
                label: r.name,
              }))}
              error={formErrors.reasonId}
            />
          </div>

          <Input
            label="Audit Notes / Explanation"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Audit correction after monthly cycle count"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Submit Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
