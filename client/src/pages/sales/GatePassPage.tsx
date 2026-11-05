import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Warehouse as WarehouseIcon,
  Calendar,
  X,
  AlertCircle,
  Truck,
  User,
  Phone,
  FileCheck,
  LogOut,
  Printer,
  QrCode,
} from 'lucide-react';
import { salesApi, GatePass, Dispatch } from '../../api/sales.api';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';

export const GatePassPage: React.FC = () => {
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGP, setSelectedGP] = useState<GatePass | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  const [formData, setFormData] = useState({
    salesOrderId: '',
    dispatchId: '',
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    remarks: '',
  });

  // Gate Out & Print Modals
  const [showGateOutModal, setShowGateOutModal] = useState(false);
  const [gateOutNotes, setGateOutNotes] = useState('Outbound vehicle inspected, seals verified intact.');
  const [showPrintGPModal, setShowPrintGPModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadGatePasses();
  }, [statusFilter]);

  const loadGatePasses = async () => {
    try {
      setLoading(true);
      const res = await salesApi.getGatePasses({
        status: statusFilter || undefined,
        limit: 50,
      });
      setGatePasses(res.data || []);
    } catch (err) {
      console.error('Failed to load gate passes', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = async () => {
    try {
      setShowCreateModal(true);
      const res = await salesApi.getDispatches({ limit: 30 });
      setDispatches(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      console.error('Failed to load dispatches', err);
    }
  };

  const handleSelectDispatch = (dspId: string) => {
    const dsp = dispatches.find((d) => d._id === dspId);
    if (dsp) {
      setFormData({
        salesOrderId: dsp.salesOrderId?._id || dsp.salesOrderId,
        dispatchId: dsp._id,
        vehicleNumber: dsp.vehicleNumber || '',
        driverName: dsp.driverName || '',
        driverContact: dsp.driverContact || '',
        remarks: 'Standard security clearance for dispatched cargo',
      });
    }
  };

  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await salesApi.createGatePass(formData);
      setShowCreateModal(false);
      await loadGatePasses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create gate pass');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveGP = async (id: string) => {
    try {
      setActionLoading(true);
      await salesApi.approveGatePass(id);
      await loadGatePasses();
      if (selectedGP?._id === id) {
        const updated = await salesApi.getGatePassById(id);
        setSelectedGP(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve gate pass');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordGateOut = async () => {
    if (!selectedGP) return;
    try {
      setActionLoading(true);
      await salesApi.recordGateOut(selectedGP._id, gateOutNotes);
      setShowGateOutModal(false);
      await loadGatePasses();
      const updated = await salesApi.getGatePassById(selectedGP._id);
      setSelectedGP(updated);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record gate out');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredGatePasses = (Array.isArray(gatePasses) ? gatePasses : []).filter((gp) => {
    const matches =
      gp.gatePassNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gp.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gp.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matches;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <span>Security Gate Passes</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Security desk checkpoint, outbound vehicle clearance &amp; gate-out timestamping
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-purple-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Gate Pass</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Gate Pass #, Driver, Vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 text-white pl-9 pr-3 py-1.5 text-xs rounded-lg focus:ring-2 focus:ring-purple-500 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['', 'READY', 'APPROVED', 'GATE_OUT', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st || 'All Passes'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedGP ? 'lg:col-span-2' : 'lg:col-span-3'} bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Gate Pass #</th>
                  <th className="py-3 px-4">Vehicle Number</th>
                  <th className="py-3 px-4">Driver Name</th>
                  <th className="py-3 px-4">Exit Time</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-800/20">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 bg-slate-800" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-20 rounded-full mx-auto bg-slate-800" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-14 rounded ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : filteredGatePasses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      No gate passes found.
                    </td>
                  </tr>
                ) : (
                  filteredGatePasses.map((gp) => (
                    <tr
                      key={gp._id}
                      onClick={() => setSelectedGP(gp)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        selectedGP?._id === gp._id ? 'bg-purple-600/10 border-l-2 border-purple-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{gp.gatePassNumber}</td>
                      <td className="py-3.5 px-4 text-slate-200 font-mono font-semibold">{gp.vehicleNumber || 'No vehicle'}</td>
                      <td className="py-3.5 px-4 text-slate-300">{gp.driverName || 'Driver'}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {gp.gateOutTime ? (
                          <span className="text-emerald-400 font-mono text-[11px]">
                            {new Date(gp.gateOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">Not departed</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                          gp.status === 'GATE_OUT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          gp.status === 'APPROVED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          gp.status === 'READY' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'bg-slate-700/30 text-slate-400 border-slate-700'
                        }`}>
                          {gp.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGP(gp);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Details */}
        {selectedGP && (
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Security Clearance</div>
                <h3 className="text-lg font-bold text-white mt-0.5">{selectedGP.gatePassNumber}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPrintGPModal(true)}
                  title="Print Security Gate Pass Slip"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedGP(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Name:</span>
                <span className="font-semibold text-white">{selectedGP.driverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Phone:</span>
                <span className="text-slate-300">{selectedGP.driverContact || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vehicle Registration:</span>
                <span className="text-slate-200 font-mono font-bold">{selectedGP.vehicleNumber}</span>
              </div>
              {selectedGP.gateOutTime && (
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Departure Timestamp:</span>
                  <span className="text-emerald-400 font-mono font-semibold">
                    {new Date(selectedGP.gateOutTime).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              {selectedGP.status === 'READY' && (
                <button
                  onClick={() => handleApproveGP(selectedGP._id)}
                  disabled={actionLoading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Approve Security Clearance</span>
                </button>
              )}

              {selectedGP.status === 'APPROVED' && (
                <button
                  onClick={() => setShowGateOutModal(true)}
                  disabled={actionLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Record Vehicle Departure (Gate Out)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gate Out Modal */}
      {showGateOutModal && selectedGP && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <LogOut className="w-5 h-5 text-emerald-400" />
              <span>Record Outbound Vehicle Departure</span>
            </h3>
            <p className="text-xs text-slate-300">
              Confirming Gate Out for Vehicle <strong className="text-white font-mono">{selectedGP.vehicleNumber}</strong> will stamp an immutable departure timestamp and close security clearance.
            </p>
            <textarea
              rows={3}
              value={gateOutNotes}
              onChange={(e) => setGateOutNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Inspection notes or lane departure remarks..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowGateOutModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordGateOut}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {actionLoading ? 'Recording...' : 'Confirm Gate Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <span>Generate Security Gate Pass</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGatePass} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Outbound Dispatch *</label>
                <Select
                  value={formData.dispatchId}
                  onChange={(e) => handleSelectDispatch(e.target.value)}
                  placeholder="Select Dispatch..."
                  variant="purple"
                  searchable
                  options={(Array.isArray(dispatches) ? dispatches : []).map((d) => ({
                    value: d._id,
                    label: `${d.dispatchNumber} • ${d.vehicleNumber} • ${d.driverName}`,
                    badge: d.dispatchNumber,
                    sublabel: `Carrier: ${d.carrier || 'N/A'}`,
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Vehicle License / ID</label>
                  <input
                    type="text"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Driver Full Name</label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Driver Contact Phone</label>
                <input
                  type="text"
                  value={formData.driverContact}
                  onChange={(e) => setFormData({ ...formData, driverContact: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !formData.dispatchId}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold shadow transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    actionLoading || !formData.dispatchId
                      ? 'bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed shadow-none'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20 active:scale-[0.98]'
                  }`}
                >
                  {actionLoading ? 'Generating...' : 'Generate Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print Gate Pass Modal */}
      {showPrintGPModal && selectedGP && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6 my-auto print:m-0 print:p-4 print:shadow-none">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <div className="text-2xl font-black text-slate-900">StockPilot ERP</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Factory Security &bull; Outbound Gate Pass
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Official Transport Clearance Document</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold px-3 py-1 bg-purple-100 text-purple-900 rounded-full uppercase tracking-wider border border-purple-200">
                  {selectedGP.status === 'GATE_OUT' ? 'DEPARTED / CLOSED' : selectedGP.status}
                </span>
                <div className="text-xl font-mono font-bold text-slate-900 mt-2">{selectedGP.gatePassNumber}</div>
                <div className="text-xs text-slate-500">
                  Date: {new Date(selectedGP.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Vehicle & Driver Card */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-500 uppercase text-[10px]">Carrier &amp; Driver:</div>
                <div className="text-base font-bold text-slate-900">{selectedGP.driverName || 'Driver Unassigned'}</div>
                <div className="text-slate-600">Contact: {selectedGP.driverContact || 'N/A'}</div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-500 uppercase text-[10px]">Vehicle &amp; Departure:</div>
                <div className="text-base font-mono font-bold text-purple-800">{selectedGP.vehicleNumber}</div>
                <div className="text-slate-600">
                  Departure Time:{' '}
                  {selectedGP.gateOutTime ? new Date(selectedGP.gateOutTime).toLocaleString() : 'Pending Gate-Out'}
                </div>
              </div>
            </div>

            {/* Consignee & Order */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Consignee Customer:</span>
                <span className="font-bold text-slate-900">{selectedGP.customerId?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Sales Order Ref:</span>
                <span className="font-semibold text-slate-800">{selectedGP.salesOrderId?.soNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Dispatch Number:</span>
                <span className="font-mono text-slate-700">{selectedGP.dispatchId?.dispatchNumber || '-'}</span>
              </div>
            </div>

            {/* Barcode / QR Simulation Block */}
            <div className="p-4 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800">Security Verification Checksum</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ID: {selectedGP._id} &bull; CRC-32 VERIFIED
                </div>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                <QrCode className="w-10 h-10 text-slate-900" />
              </div>
            </div>

            {/* Security Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Driver Signature &amp; Acknowledgement</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-700">Security Checkpoint Officer Stamp</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => setShowPrintGPModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close Preview
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Security Gate Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
