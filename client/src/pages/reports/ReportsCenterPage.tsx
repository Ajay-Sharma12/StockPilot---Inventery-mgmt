import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Warehouse as WarehouseIcon,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Factory,
  ShieldCheck,
  Boxes,
} from 'lucide-react';
import { reportingApi, ReportCategory, ReportDefinition, ReportQueryResult } from '../../api/reporting.api';
import { warehouseApi, Warehouse } from '../../api/warehouse.api';
import { usePermissions } from '../../hooks/usePermissions';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Select } from '../../components/ui/Select';

export const ReportsCenterPage: React.FC = () => {
  const { can } = usePermissions();
  const [reportTypes, setReportTypes] = useState<ReportDefinition[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('PRODUCTION');
  const [selectedReportType, setSelectedReportType] = useState<string>('production-orders');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30'); // days

  // Report Query State
  const [queryResult, setQueryResult] = useState<ReportQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [queryError, setQueryError] = useState('');

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoading(true);
      const [typesRes, whsRes] = await Promise.all([
        reportingApi.getReportTypes(),
        warehouseApi.getWarehouses(),
      ]);
      setReportTypes(typesRes || []);
      setWarehouses(whsRes || []);
    } catch (err) {
      console.error('Failed to load report definitions', err);
    } finally {
      setLoading(false);
    }
  };

  // Switch default reportType when category changes
  useEffect(() => {
    const matching = reportTypes.filter((r) => r.category === selectedCategory);
    if (matching.length > 0) {
      setSelectedReportType(matching[0].reportType);
    }
  }, [selectedCategory, reportTypes]);

  // Run report query
  useEffect(() => {
    if (selectedReportType) {
      handleRunReport();
    }
  }, [selectedReportType, selectedWarehouseId, dateRange]);

  const handleRunReport = async () => {
    if (!selectedReportType) return;
    try {
      setQueryLoading(true);
      setQueryError('');

      let startDate: string | undefined;
      let endDate: string | undefined;

      if (dateRange !== 'ALL') {
        const days = Number(dateRange) || 30;
        startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        endDate = new Date().toISOString();
      }

      const res = await reportingApi.runReport({
        category: selectedCategory,
        reportType: selectedReportType,
        warehouseId: selectedWarehouseId || undefined,
        startDate,
        endDate,
      });

      setQueryResult(res);
    } catch (err: any) {
      setQueryError(err.response?.data?.message || 'Failed to generate operational report');
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedReportType) return;
    try {
      setExporting(true);
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (dateRange !== 'ALL') {
        const days = Number(dateRange) || 30;
        startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        endDate = new Date().toISOString();
      }

      const blob = await reportingApi.exportReportCsv({
        category: selectedCategory,
        reportType: selectedReportType,
        warehouseId: selectedWarehouseId || undefined,
        startDate,
        endDate,
      });

      // Trigger download
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedReportType}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  const currentCategoryReports = reportTypes.filter((r) => r.category === selectedCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Operational Intelligence</span>
            <span>&bull;</span>
            <span className="text-indigo-600 dark:text-indigo-400">Audited Reporting</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Cross-Functional Reports Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Exportable operational reports directly aggregated from verified transaction tables with facility ABAC enforcement
          </p>
        </div>

        {can('reports:export') && (
          <button
            onClick={handleExportCsv}
            disabled={exporting || !queryResult?.data || queryResult.data.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generating CSV...' : 'Export to CSV'}
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'PRODUCTION', label: 'Production & Mfg', icon: Factory },
          { id: 'QC', label: 'Quality Control', icon: ShieldCheck },
          { id: 'INVENTORY', label: 'Inventory & Stock', icon: Boxes },
          { id: 'PROCUREMENT', label: 'Procurement', icon: ShoppingBag },
          { id: 'SALES', label: 'Sales & Invoices', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id as ReportCategory)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dynamic Filter Console */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Select Specific Report Query *"
            value={selectedReportType}
            onChange={(e) => setSelectedReportType(e.target.value)}
            options={currentCategoryReports.map((r) => ({
              value: r.reportType,
              label: r.name,
            }))}
          />

          <Select
            label="Facility Warehouse Scope"
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            placeholder="All Authorized Facilities"
            options={[
              { value: '', label: 'All Authorized Facilities' },
              ...warehouses.map((w) => ({
                value: w._id,
                label: `${w.name} (${w.code})`,
              })),
            ]}
          />

          <Select
            label="Date Horizon"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: '7', label: 'Last 7 Days' },
              { value: '30', label: 'Last 30 Days' },
              { value: '90', label: 'Last 90 Days' },
              { value: 'ALL', label: 'All Available History' },
            ]}
          />
        </div>
      </div>

      {queryError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{queryError}</span>
        </div>
      )}

      {/* Summary KPI Cards (Computed from Summary Object) */}
      {queryResult?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(queryResult.summary).map(([key, val]) => (
            <div
              key={key}
              className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Query Results Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Data Output &bull; {queryResult?.data?.length || 0} rows returned
            </h3>
          </div>
          <button
            onClick={handleRunReport}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh query"
          >
            <RefreshCw className={`w-4 h-4 ${queryLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          {queryLoading ? (
            <div className="p-4">
              <TableSkeleton rows={6} columns={6} />
            </div>
          ) : !queryResult?.data || queryResult.data.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">No records found matching query criteria.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {queryResult.data[0] ? Object.keys(queryResult.data[0]).map((header) => (
                    <th key={header} className="py-3 px-4 whitespace-nowrap">
                      {header.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  )) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {queryResult.data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    {queryResult.data[0] && Object.keys(queryResult.data[0]).map((header) => {
                      const cellValue = row[header];
                      return (
                        <td key={header} className="py-2.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {typeof cellValue === 'object' && cellValue !== null
                            ? JSON.stringify(cellValue)
                            : String(cellValue ?? '-')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
