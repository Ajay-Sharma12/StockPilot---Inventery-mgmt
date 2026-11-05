import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures an HTML element and triggers a direct PDF file download.
 * @param element HTMLElement or string ID of the container to render into PDF
 * @param fileName Desired file name (e.g. 'INV-00001.pdf')
 */
export async function downloadElementAsPdf(
  element: HTMLElement | string,
  fileName: string = 'document.pdf'
): Promise<void> {
  const targetEl = typeof element === 'string' ? document.getElementById(element) : element;
  if (!targetEl) {
    console.error('Target element not found for PDF generation');
    window.print();
    return;
  }

  // Ensure clean filename ending
  const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  try {
    // Render high-res canvas (scale: 2 for sharp vector-like typography)
    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      ignoreElements: (el) => el.classList.contains('print-hide') || el.classList.contains('print:hidden'),
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Maintain aspect ratio
    const imgWidth = pdfWidth - 20; // 10mm margins on left & right
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10; // top margin

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;

    // Handle multi-page documents if content exceeds 1 page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;
    }

    pdf.save(safeFileName);
  } catch (err) {
    console.warn('Direct PDF canvas generation encountered an issue, falling back to browser print dialog:', err);
    window.print();
  }
}
