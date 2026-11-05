import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  CheckCircle2,
  Send,
  Truck,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { inventoryApi } from '../../api/inventory.api';
import { warehouseApi } from '../../api/warehouse.api';
import { masterDataApi } from '../../api/masterData.api';
import { itemApi } from '../../api/item.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { Link } from 'react-router-dom';

export const StockTransfersPage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const { success, error: toastError } = useToast();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState<number>(10);
  const [remarks, setRemarks] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [transfersRes, whRes, itemsRes] = await Promise.all([
        inventoryApi.getTransfers({ limit: 50 }),
        warehouseApi.getWarehouses(),
        itemApi.getItems({ limit: 100 }),
      ]);

      let whs = whRes || [];
      if (whs.length === 0) {
        try {
          await masterDataApi.initializeStarterData();
          whs = await warehouseApi.getWarehouses();
        } catch (initErr) {
          console.warn('Auto starter warehouse initialization in Transfers skipped:', initErr);
        }
      }

      setTransfers(transfersRes.data || []);
      setWarehouses(whs || []);
      setItemsList(itemsRes.data || []);
    } catch (err) {
      console.error('Failed to load transfers', err);
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

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!fromWarehouseId) {
      errors.fromWarehouseId = 'Origin warehouse is required';
    }
    if (!toWarehouseId) {
      errors.toWarehouseId = 'Destination warehouse is required';
    } else if (fromWarehouseId && fromWarehouseId === toWarehouseId) {
      errors.toWarehouseId = 'Destination must differ from origin warehouse';
    }
    if (!selectedItemId) {
      errors.itemId = 'Item to transfer is required';
    }
    if (!requestedQuantity || Number(requestedQuantity) <= 0) {
      errors.quantity = 'Quantity must be at least 1';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      await inventoryApi.createTransfer({
        fromWarehouseId,
        toWarehouseId,
        items: [
          {
            itemId: selectedItemId,
            requestedQuantity: Number(requestedQuantity),
          },
        ],
        remarks,
      });

      setIsCreateModalOpen(false);
      setFromWarehouseId('');
      setToWarehouseId('');
      setSelectedItemId('');
      setRequestedQuantity(10);
      setRemarks('');
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to create transfer order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (action: 'submit' | 'approve' | 'dispatch' | 'receive', transferId: string) => {
    try {
      setActionLoading(true);
      if (action === 'submit') await inventoryApi.submitTransfer(transferId);
      if (action === 'approve') await inventoryApi.approveTransfer(transferId);
      if (action === 'dispatch') await inventoryApi.dispatchTransfer(transferId);
      if (action === 'receive') await inventoryApi.receiveTransfer(transferId);
      success(`Transfer order ${action}ed successfully`);
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || err.message || `Failed to ${action} transfer`);
    } finally {
      setActionLoading(false);
    }
  };

  const canTransfer = isSuperAdmin || can('inventory:transfer');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'SUBMITTED':
        return <Badge variant="warning">Submitted</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Approved</Badge>;
      case 'DISPATCHED':
        return <Badge variant="warning">Dispatched (In-Transit)</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-7 h-7 text-emerald-400" />
            Inter-Warehouse Stock Transfers
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Multi-facility replenishment pipeline with strict approval, dispatch deduction, and destination receipt
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

          {canTransfer && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError('');
                setFormErrors({});
                setFromWarehouseId('');
                setToWarehouseId('');
                setSelectedItemId('');
                setRequestedQuantity(10);
                setRemarks('');
                setIsCreateModalOpen(true);
              }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Transfer Order
            </Button>
          )}
        </div>
      </div>

      {/* Transfers Table */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Transfer #</th>
                  <th className="py-3 px-4 font-semibold">Origin Warehouse</th>
                  <th className="py-3 px-4 font-semibold">Destination</th>
                  <th className="py-3 px-4 font-semibold">Items & Quantities</th>
                  <th className="py-3 px-4 font-semibold">Requested By</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      {loading ? 'Loading transfer orders...' : 'No stock transfers created yet.'}
                    </td>
                  </tr>
                ) : (
                  transfers.map((tr) => (
                    <tr key={tr._id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {tr.transferNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {tr.fromWarehouseId?.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {tr.toWarehouseId?.code}
                      </td>
                      <td className="py-3 px-4">
                        {tr.items?.map((itm: any, idx: number) => (
                          <div key={idx} className="font-mono text-slate-700 dark:text-slate-300">
                            {itm.itemId?.sku} &times; <strong className="text-slate-900 dark:text-white">{itm.requestedQuantity}</strong>
                            {tr.status === 'DISPATCHED' && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">(Dispatched: {itm.dispatchedQuantity})</span>
                            )}
                            {tr.status === 'COMPLETED' && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 ml-1">(Received: {itm.receivedQuantity})</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {tr.requestedBy?.name || 'System'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(tr.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {tr.status === 'DRAFT' && canTransfer && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction('submit', tr._id)}
                              isLoading={actionLoading}
                              className="text-[11px] h-7 border-slate-700 hover:bg-slate-800"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Submit
                            </Button>
                          )}

                          {tr.status === 'SUBMITTED' && canTransfer && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleAction('approve', tr._id)}
                              isLoading={actionLoading}
                              className="text-[11px] h-7 bg-blue-600 hover:bg-blue-500"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          )}

                          {tr.status === 'APPROVED' && canTransfer && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleAction('dispatch', tr._id)}
                              isLoading={actionLoading}
                              className="text-[11px] h-7 bg-amber-600 hover:bg-amber-500"
                            >
                              <Truck className="w-3 h-3 mr-1" />
                              Dispatch
                            </Button>
                          )}

                          {tr.status === 'DISPATCHED' && canTransfer && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleAction('receive', tr._id)}
                              isLoading={actionLoading}
                              className="text-[11px] h-7 bg-emerald-600 hover:bg-emerald-500"
                            >
                              <PackageCheck className="w-3 h-3 mr-1" />
                              Receive
                            </Button>
                          )}

                          {tr.status === 'COMPLETED' && (
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Completed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Transfer Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Initiate Stock Transfer Order"
        description="Creates an inter-facility transfer order to be submitted, approved, dispatched, and received"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs" noValidate>
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          {warehouses.length < 2 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>Inter-facility transfers require at least two active warehouses.</span>
              <Link to="/inventory/warehouses" className="font-semibold text-emerald-400 hover:underline">
                Create Warehouse &rarr;
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Origin Warehouse *"
              value={fromWarehouseId}
              onChange={(e) => {
                setFromWarehouseId(e.target.value);
                if (formErrors.fromWarehouseId) setFormErrors((prev) => ({ ...prev, fromWarehouseId: '' }));
              }}
              error={formErrors.fromWarehouseId}
              placeholder="Select origin..."
              options={warehouses.map((wh) => ({
                value: wh._id,
                label: `${wh.code} - ${wh.name}`,
              }))}
            />
            <Select
              label="Destination Warehouse *"
              value={toWarehouseId}
              onChange={(e) => {
                setToWarehouseId(e.target.value);
                if (formErrors.toWarehouseId) setFormErrors((prev) => ({ ...prev, toWarehouseId: '' }));
              }}
              error={formErrors.toWarehouseId}
              placeholder="Select destination..."
              options={warehouses.map((wh) => ({
                value: wh._id,
                label: `${wh.code} - ${wh.name}`,
              }))}
            />
          </div>

          {itemsList.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>No items registered in your catalog yet.</span>
              <Link to="/inventory/items" className="font-semibold text-emerald-400 hover:underline">
                Register Items &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Select
                  label="Item to Transfer *"
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    if (formErrors.itemId) setFormErrors((prev) => ({ ...prev, itemId: '' }));
                  }}
                  error={formErrors.itemId}
                  placeholder="Select SKU..."
                  options={itemsList.map((item) => ({
                    value: item._id,
                    label: `${item.sku} - ${item.name}`,
                  }))}
                />
              </div>
              <div>
                <Input
                  label="Transfer Qty *"
                  type="number"
                  min="1"
                  step="any"
                  value={requestedQuantity}
                  onChange={(e) => {
                    setRequestedQuantity(Number(e.target.value));
                    if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: '' }));
                  }}
                  error={formErrors.quantity}
                />
              </div>
            </div>
          )}

          <div>
            <Input
              label="Remarks / Internal Note"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Weekly depot replenishment"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Create Transfer Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
