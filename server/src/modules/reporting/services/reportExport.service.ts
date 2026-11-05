export class ReportExportService {
  convertToCSV(data: any[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Add Header row
    csvRows.push(headers.map((h) => this.escapeCSV(h)).join(','));

    // Add Data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        if (val instanceof Date) return `"${val.toISOString()}"`;
        if (typeof val === 'object') return this.escapeCSV(JSON.stringify(val));
        return this.escapeCSV(String(val));
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\r\n');
  }

  private escapeCSV(value: string): string {
    const stringValue = String(value).replace(/"/g, '""');
    return `"${stringValue}"`;
  }
}

export const reportExportService = new ReportExportService();
