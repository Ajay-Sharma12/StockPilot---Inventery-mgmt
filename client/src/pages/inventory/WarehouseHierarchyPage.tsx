import React, { useState, useEffect } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  RefreshCw,
  FolderTree,
  MapPin,
  ChevronRight,
  Layers,
  Box,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { warehouseApi } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';

export const WarehouseHierarchyPage: React.FC = () => {
  const { can, isSuperAdmin } = usePermissions();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [hierarchyTree, setHierarchyTree] = useState<any>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  // Create Warehouse Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('MAIN');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Add Zone Modal
  const [isAddZoneModalOpen, setIsAddZoneModalOpen] = useState(false);
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneErrors, setZoneErrors] = useState<Record<string, string>>({});
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneErrorMsg, setZoneErrorMsg] = useState('');

  // Add Rack Modal
  const [isAddRackModalOpen, setIsAddRackModalOpen] = useState(false);
  const [targetZone, setTargetZone] = useState<any>(null);
  const [rackCode, setRackCode] = useState('');
  const [rackName, setRackName] = useState('');
  const [rackErrors, setRackErrors] = useState<Record<string, string>>({});
  const [rackLoading, setRackLoading] = useState(false);
  const [rackErrorMsg, setRackErrorMsg] = useState('');

  // Add Bin Modal
  const [isAddBinModalOpen, setIsAddBinModalOpen] = useState(false);
  const [targetRack, setTargetRack] = useState<any>(null);
  const [targetZoneForBin, setTargetZoneForBin] = useState<any>(null);
  const [binCode, setBinCode] = useState('');
  const [binName, setBinName] = useState('');
  const [binCapacity, setBinCapacity] = useState<number | string>('');
  const [binErrors, setBinErrors] = useState<Record<string, string>>({});
  const [binLoading, setBinLoading] = useState(false);
  const [binErrorMsg, setBinErrorMsg] = useState('');

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await warehouseApi.getWarehouses();
      setWarehouses(data || []);
      if (data && data.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load warehouses', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHierarchyTree = async (whId: string) => {
    try {
      setTreeLoading(true);
      const data = await warehouseApi.getWarehouseHierarchyTree(whId);
      setHierarchyTree(data);
    } catch (err) {
      console.error('Failed to load hierarchy tree', err);
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouseId) {
      loadHierarchyTree(selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await warehouseApi.getWarehouses();
      const whList = data || [];
      setWarehouses(whList);

      const targetId = selectedWarehouseId || (whList.length > 0 ? whList[0]._id : '');
      if (targetId) {
        if (!selectedWarehouseId) {
          setSelectedWarehouseId(targetId);
        }
        await loadHierarchyTree(targetId);
      }
    } catch (err) {
      console.error('Failed to refresh warehouse data', err);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!code.trim()) {
      errors.code = 'Facility Code is required';
    } else if (!/^[A-Za-z0-9_-]+$/.test(code.trim())) {
      errors.code = 'Code must contain only letters, numbers, hyphens or underscores';
    }

    if (!name.trim()) {
      errors.name = 'Facility Name is required';
    }

    if (!type) {
      errors.type = 'Warehouse Type is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      setActionLoading(true);
      setActionError('');
      const created = await warehouseApi.createWarehouse({
        code: code.toUpperCase().trim(),
        name: name.trim(),
        type,
        address: { street: street.trim(), city: city.trim(), state: state.trim(), country: 'USA' },
      });

      setIsCreateModalOpen(false);
      setCode('');
      setName('');
      setStreet('');
      setCity('');
      setState('');
      setFormErrors({});
      await loadWarehouses();
      setSelectedWarehouseId(created._id);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to create warehouse');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!zoneCode.trim()) errors.code = 'Zone Code is required (e.g. ZONE-A)';
    if (!zoneName.trim()) errors.name = 'Zone Name is required (e.g. Raw Material Storage)';

    if (Object.keys(errors).length > 0) {
      setZoneErrors(errors);
      return;
    }
    setZoneErrors({});

    try {
      setZoneLoading(true);
      setZoneErrorMsg('');
      await warehouseApi.createZone({
        warehouseId: selectedWarehouseId,
        code: zoneCode.toUpperCase().trim(),
        name: zoneName.trim(),
      });
      setIsAddZoneModalOpen(false);
      setZoneCode('');
      setZoneName('');
      await loadHierarchyTree(selectedWarehouseId);
    } catch (err: any) {
      setZoneErrorMsg(err.response?.data?.message || err.message || 'Failed to create zone');
    } finally {
      setZoneLoading(false);
    }
  };

  const handleAddRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetZone) return;
    const errors: Record<string, string> = {};
    if (!rackCode.trim()) errors.code = 'Rack Code is required (e.g. RACK-01)';
    if (!rackName.trim()) errors.name = 'Rack Name is required (e.g. Bay 1 Heavy Duty Rack)';

    if (Object.keys(errors).length > 0) {
      setRackErrors(errors);
      return;
    }
    setRackErrors({});

    try {
      setRackLoading(true);
      setRackErrorMsg('');
      await warehouseApi.createRack({
        warehouseId: selectedWarehouseId,
        zoneId: targetZone.id,
        code: rackCode.toUpperCase().trim(),
        name: rackName.trim(),
      });
      setIsAddRackModalOpen(false);
      setRackCode('');
      setRackName('');
      setTargetZone(null);
      await loadHierarchyTree(selectedWarehouseId);
    } catch (err: any) {
      setRackErrorMsg(err.response?.data?.message || err.message || 'Failed to create rack');
    } finally {
      setRackLoading(false);
    }
  };

  const handleAddBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRack || !targetZoneForBin) return;
    const errors: Record<string, string> = {};
    if (!binCode.trim()) errors.code = 'Bin Code is required (e.g. BIN-A1-01)';
    if (!binName.trim()) errors.name = 'Bin Name is required (e.g. Level 1 Pallet Slot)';

    if (Object.keys(errors).length > 0) {
      setBinErrors(errors);
      return;
    }
    setBinErrors({});

    try {
      setBinLoading(true);
      setBinErrorMsg('');
      await warehouseApi.createBin({
        warehouseId: selectedWarehouseId,
        zoneId: targetZoneForBin.id,
        rackId: targetRack.id,
        code: binCode.toUpperCase().trim(),
        name: binName.trim(),
        capacity: binCapacity ? Number(binCapacity) : undefined,
      });
      setIsAddBinModalOpen(false);
      setBinCode('');
      setBinName('');
      setBinCapacity('');
      setTargetRack(null);
      setTargetZoneForBin(null);
      await loadHierarchyTree(selectedWarehouseId);
    } catch (err: any) {
      setBinErrorMsg(err.response?.data?.message || err.message || 'Failed to create bin');
    } finally {
      setBinLoading(false);
    }
  };

  const canManage = isSuperAdmin || can('warehouses:manage');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <WarehouseIcon className="w-7 h-7 text-emerald-400" />
            Warehouses & Multi-Level Locations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure multi-tier facility hierarchy: Warehouse &rarr; Storage Zones &rarr; Racks &rarr; Bins
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing || treeLoading}
            className="text-xs border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing || loading ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActionError('');
                setFormErrors({});
                setCode('');
                setName('');
                setType('MAIN');
                setStreet('');
                setCity('');
                setState('');
                setIsCreateModalOpen(true);
              }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Warehouse
            </Button>
          )}
        </div>
      </div>

      {/* Facilities Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const isSelected = wh._id === selectedWarehouseId;
          return (
            <div
              key={wh._id}
              onClick={() => setSelectedWarehouseId(wh._id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-emerald-400">{wh.code}</span>
                  <h3 className="text-sm font-semibold text-white mt-0.5">{wh.name}</h3>
                </div>
                <Badge variant={wh.type === 'MAIN' ? 'success' : 'secondary'} size="sm">
                  {wh.type}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">
                  {wh.address?.street ? `${wh.address.street}, ${wh.address.city}` : 'No address provided'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hierarchy Tree Visualizer */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-md">
        <CardHeader className="py-3 px-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              Hierarchy Structure: {hierarchyTree?.name || 'Selected Warehouse'}
            </CardTitle>
            <span className="text-xs text-slate-500">Warehouse &rarr; Zones &rarr; Racks &rarr; Bins (Storage Locations)</span>
          </div>

          {canManage && selectedWarehouseId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setZoneCode('');
                setZoneName('');
                setZoneErrors({});
                setZoneErrorMsg('');
                setIsAddZoneModalOpen(true);
              }}
              className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Zone
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {treeLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Loading location hierarchy...</span>
            </div>
          ) : !hierarchyTree || hierarchyTree.zones?.length === 0 ? (
            <div className="py-10 text-center text-xs space-y-3">
              <p className="text-slate-400">No storage zones configured for this warehouse facility yet.</p>
              {canManage && selectedWarehouseId && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setZoneCode('');
                    setZoneName('');
                    setZoneErrors({});
                    setZoneErrorMsg('');
                    setIsAddZoneModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add First Storage Zone
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {hierarchyTree.zones.map((zone: any) => (
                <div key={zone.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Zone: {zone.name}</span>
                      <span className="font-mono text-[11px] text-slate-400 font-normal">[{zone.code}]</span>
                    </div>

                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTargetZone(zone);
                          setRackCode('');
                          setRackName('');
                          setRackErrors({});
                          setRackErrorMsg('');
                          setIsAddRackModalOpen(true);
                        }}
                        className="text-[11px] h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Rack
                      </Button>
                    )}
                  </div>

                  {zone.racks?.length === 0 ? (
                    <div className="py-2 px-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>No racks inside this zone</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetZone(zone);
                            setRackCode('');
                            setRackName('');
                            setRackErrors({});
                            setRackErrorMsg('');
                            setIsAddRackModalOpen(true);
                          }}
                          className="text-emerald-400 hover:underline font-medium"
                        >
                          + Add Rack
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="ml-2 sm:ml-4 space-y-3 border-l-2 border-slate-800 pl-3 sm:pl-4">
                      {zone.racks.map((rack: any) => (
                        <div key={rack.id} className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                              <Box className="w-3.5 h-3.5 text-blue-400" />
                              <span>Rack: {rack.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">[{rack.code}]</span>
                            </div>

                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTargetRack(rack);
                                  setTargetZoneForBin(zone);
                                  setBinCode('');
                                  setBinName('');
                                  setBinCapacity('');
                                  setBinErrors({});
                                  setBinErrorMsg('');
                                  setIsAddBinModalOpen(true);
                                }}
                                className="text-[11px] h-6 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/30"
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add Bin
                              </Button>
                            )}
                          </div>

                          {rack.bins?.length === 0 ? (
                            <div className="py-1 px-2 text-slate-500 text-[11px] flex items-center justify-between">
                              <span>No bin locations on this rack</span>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetRack(rack);
                                    setTargetZoneForBin(zone);
                                    setBinCode('');
                                    setBinName('');
                                    setBinCapacity('');
                                    setBinErrors({});
                                    setBinErrorMsg('');
                                    setIsAddBinModalOpen(true);
                                  }}
                                  className="text-blue-400 hover:underline font-medium"
                                >
                                  + Add Bin
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {rack.bins.map((bin: any) => (
                                <div
                                  key={bin.id}
                                  className="px-2.5 py-1.5 rounded-md bg-slate-950/80 text-slate-200 border border-slate-700/80 flex items-center gap-2 text-xs shadow-sm hover:border-emerald-500/40 transition-colors"
                                >
                                  <span className="font-mono font-bold text-emerald-400">{bin.code}</span>
                                  <span className="text-slate-300">{bin.name}</span>
                                  {bin.capacity ? (
                                    <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
                                      Cap: {bin.capacity}
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Warehouse Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Warehouse Facility"
        description="Register a distribution center, regional depot, or production plant"
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4 text-xs" noValidate>
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Facility Code *"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: '' }));
                }}
                placeholder="e.g. WH-EAST"
                error={formErrors.code}
              />
            </div>
            <div>
              <Input
                label="Facility Name *"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="e.g. Eastern Distribution Depot"
                error={formErrors.name}
              />
            </div>
          </div>

          <Select
            label="Warehouse Type *"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              if (formErrors.type) setFormErrors((prev) => ({ ...prev, type: '' }));
            }}
            error={formErrors.type}
            options={[
              { value: 'MAIN', label: 'Main Distribution Center' },
              { value: 'REGIONAL', label: 'Regional Depot' },
              { value: 'PLANT', label: 'Manufacturing Plant' },
              { value: 'TRANSIT', label: 'Transit Facility' },
              { value: 'QUARANTINE', label: 'Quarantine & QC Bay' },
            ]}
          />

          <div className="space-y-2">
            <label className="block text-slate-300 font-medium">Facility Address</label>
            <Input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Street address..."
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State / Region"
              />
            </div>
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
              Register Facility
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Zone Modal */}
      <Modal
        isOpen={isAddZoneModalOpen}
        onClose={() => {
          setIsAddZoneModalOpen(false);
          setZoneErrors({});
        }}
        title="Add Storage Zone"
        description={`Add a functional storage zone inside ${hierarchyTree?.name || 'facility'}`}
      >
        <form onSubmit={handleAddZone} noValidate className="space-y-4 text-xs">
          {zoneErrorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {zoneErrorMsg}
            </div>
          )}

          <div>
            <Input
              label="Zone Code *"
              value={zoneCode}
              onChange={(e) => {
                setZoneCode(e.target.value.toUpperCase());
                if (zoneErrors.code) setZoneErrors((prev) => ({ ...prev, code: '' }));
              }}
              placeholder="e.g. ZONE-A or COLD-01"
              error={zoneErrors.code}
            />
          </div>

          <div>
            <Input
              label="Zone Name *"
              value={zoneName}
              onChange={(e) => {
                setZoneName(e.target.value);
                if (zoneErrors.name) setZoneErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. Ambient Goods Storage or Bulk Pallet Area"
              error={zoneErrors.name}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddZoneModalOpen(false);
                setZoneErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={zoneLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Save Zone
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Rack Modal */}
      <Modal
        isOpen={isAddRackModalOpen}
        onClose={() => {
          setIsAddRackModalOpen(false);
          setRackErrors({});
          setTargetZone(null);
        }}
        title={`Add Rack to ${targetZone?.name || 'Zone'}`}
        description="Configure vertical racking or shelving unit"
      >
        <form onSubmit={handleAddRack} noValidate className="space-y-4 text-xs">
          {rackErrorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {rackErrorMsg}
            </div>
          )}

          <div>
            <Input
              label="Rack Code *"
              value={rackCode}
              onChange={(e) => {
                setRackCode(e.target.value.toUpperCase());
                if (rackErrors.code) setRackErrors((prev) => ({ ...prev, code: '' }));
              }}
              placeholder="e.g. RACK-01 or AISLE-B"
              error={rackErrors.code}
            />
          </div>

          <div>
            <Input
              label="Rack Description / Name *"
              value={rackName}
              onChange={(e) => {
                setRackName(e.target.value);
                if (rackErrors.name) setRackErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. High-Bay Heavy Pallet Rack 1"
              error={rackErrors.name}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddRackModalOpen(false);
                setRackErrors({});
                setTargetZone(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={rackLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Save Rack
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Bin Modal */}
      <Modal
        isOpen={isAddBinModalOpen}
        onClose={() => {
          setIsAddBinModalOpen(false);
          setBinErrors({});
          setTargetRack(null);
          setTargetZoneForBin(null);
        }}
        title={`Add Bin Location to ${targetRack?.name || 'Rack'}`}
        description="Register addressable slot, shelf, or bin compartment for stock tracking"
      >
        <form onSubmit={handleAddBin} noValidate className="space-y-4 text-xs">
          {binErrorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {binErrorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Bin Code *"
                value={binCode}
                onChange={(e) => {
                  setBinCode(e.target.value.toUpperCase());
                  if (binErrors.code) setBinErrors((prev) => ({ ...prev, code: '' }));
                }}
                placeholder="e.g. BIN-A1-01"
                error={binErrors.code}
              />
            </div>
            <div>
              <Input
                label="Capacity (Units)"
                type="number"
                min="1"
                value={binCapacity}
                onChange={(e) => setBinCapacity(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
          </div>

          <div>
            <Input
              label="Bin / Location Title *"
              value={binName}
              onChange={(e) => {
                setBinName(e.target.value);
                if (binErrors.name) setBinErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. Ground Shelf Slot 1"
              error={binErrors.name}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddBinModalOpen(false);
                setBinErrors({});
                setTargetRack(null);
                setTargetZoneForBin(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={binLoading}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              Save Bin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
