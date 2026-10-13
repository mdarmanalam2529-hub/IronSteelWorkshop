import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '@/types/invoice';
import type { WorkshopSettings } from '@/types';
import { INDIAN_STATES } from '@/utils/gstCalculator';

interface WorkshopInfo extends WorkshopSettings {
  gst_enabled?: boolean;
  gstin?: string;
  gst_rate?: number;
  gst_type?: 'cgst_sgst' | 'igst';
  state_code?: string;
  state_name?: string;
}

/**
 * Generates a professional invoice PDF blob.
 */
export async function generateInvoicePdfBlob(
  invoice: Invoice,
  workshop: WorkshopInfo | null
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // ─── Header: Workshop Info ───────────────────────────────
  doc.setFillColor(24, 24, 27); // charcoal-950
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(workshop?.name || 'SteelWorks Workshop', margin, y + 8);

  doc.setTextColor(180, 180, 190);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const headerDetails: string[] = [];
  if (workshop?.address) headerDetails.push(workshop.address);
  if (workshop?.phone) headerDetails.push(`Phone: ${workshop.phone}`);
  if (workshop?.email) headerDetails.push(`Email: ${workshop.email}`);
  if (workshop?.gst_enabled && workshop?.gstin) headerDetails.push(`GSTIN: ${workshop.gstin}`);
  doc.text(headerDetails.join('  |  ') || '', margin, y + 16);

  // Invoice label on the right
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - margin, y + 10, { align: 'right' });

  doc.setTextColor(180, 180, 190);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${invoice.invoice_number}`, pageWidth - margin, y + 18, { align: 'right' });

  y = 48;

  // ─── Invoice Details & Customer Info ─────────────────────
  doc.setTextColor(60, 60, 70);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin, y);
  doc.text('INVOICE DETAILS', pageWidth / 2 + 10, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 40);
  doc.text(invoice.customer_name, margin, y);
  y += 4.5;
  if (invoice.customer_company) {
    doc.setTextColor(100, 100, 110);
    doc.setFontSize(9);
    doc.text(invoice.customer_company, margin, y);
    y += 4.5;
  }
  if (invoice.customer_phone) {
    doc.setTextColor(100, 100, 110);
    doc.setFontSize(9);
    doc.text(`Phone: ${invoice.customer_phone}`, margin, y);
    y += 4.5;
  }
  if (invoice.customer_address) {
    doc.setTextColor(100, 100, 110);
    doc.setFontSize(9);
    const addrLines = doc.splitTextToSize(invoice.customer_address, 70);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 4.5;
  }

  // Right column: invoice details
  const detailX = pageWidth / 2 + 10;
  let detY = 53;
  doc.setFontSize(9);

  const placeOfSupplyName = invoice.place_of_supply
    ? (INDIAN_STATES.find(s => s.code === invoice.place_of_supply)?.name || `State ${invoice.place_of_supply}`)
    : (workshop?.state_name || '—');

  const detailRows = [
    ['Invoice Date:', formatInvDate(invoice.invoice_date)],
    ['Due Date:', invoice.due_date ? formatInvDate(invoice.due_date) : '—'],
    ['Order:', invoice.order_title],
    ['Place of Supply:', placeOfSupplyName],
    ['Status:', getPaymentStatusLabel(invoice.payment_status)],
  ];
  for (const [label, value] of detailRows) {
    doc.setTextColor(100, 100, 110);
    doc.setFont('helvetica', 'normal');
    doc.text(label, detailX, detY);
    doc.setTextColor(30, 30, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(value, detailX + 30, detY);
    detY += 5;
  }

  y = Math.max(y, detY) + 5;

  // ─── Items Table ─────────────────────────────────────────
  const hasHsn = invoice.items.some(item => Boolean(item.hsn_sac));

  const tableHead = hasHsn
    ? [['#', 'Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Amount']]
    : [['#', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']];

  const tableBody = invoice.items.map((item, idx) => {
    if (hasHsn) {
      return [
        String(idx + 1),
        item.description,
        item.hsn_sac || '—',
        String(item.quantity),
        item.unit,
        formatCurrencyPdf(item.rate),
        formatCurrencyPdf(item.amount),
      ];
    }
    return [
      String(idx + 1),
      item.description,
      String(item.quantity),
      item.unit,
      formatCurrencyPdf(item.rate),
      formatCurrencyPdf(item.amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [245, 158, 11],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 50],
    },
    columnStyles: hasHsn ? {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
    } : {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: [220, 220, 225],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 252],
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ─── Totals Section ──────────────────────────────────────
  const totalsX = pageWidth - margin - 75;
  const totalsValX = pageWidth - margin;

  function totalRow(label: string, value: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(bold ? 24 : 80, bold ? 24 : 80, bold ? 27 : 90);
    doc.text(label, totalsX, y);
    doc.text(value, totalsValX, y, { align: 'right' });
    y += bold ? 7 : 5;
  }

  totalRow('Subtotal:', formatCurrencyPdf(invoice.subtotal));
  if (invoice.discount > 0) {
    totalRow('Discount:', `- ${formatCurrencyPdf(invoice.discount)}`);
  }
  if (invoice.gst_enabled && invoice.gst_amount > 0) {
    const isIgst = invoice.gst_type === 'igst' || (!invoice.gst_type && workshop?.gst_type === 'igst');
    if (isIgst) {
      const igstVal = invoice.igst_amount ?? invoice.gst_amount;
      totalRow(`IGST (${invoice.gst_rate}%):`, formatCurrencyPdf(igstVal));
    } else {
      const halfRate = invoice.gst_rate / 2;
      const cgstVal = invoice.cgst_amount ?? (invoice.gst_amount / 2);
      const sgstVal = invoice.sgst_amount ?? (invoice.gst_amount / 2);
      totalRow(`CGST (${halfRate}%):`, formatCurrencyPdf(cgstVal));
      totalRow(`SGST (${halfRate}%):`, formatCurrencyPdf(sgstVal));
    }
  }

  if (invoice.round_off && invoice.round_off !== 0) {
    totalRow('Round Off:', (invoice.round_off > 0 ? '+ ' : '') + formatCurrencyPdf(invoice.round_off));
  }

  // Separator line
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y - 2, totalsValX, y - 2);
  y += 2;

  totalRow('Grand Total:', formatCurrencyPdf(invoice.grand_total), true);
  y += 2;
  totalRow('Amount Paid:', formatCurrencyPdf(invoice.total_paid));
  totalRow('Balance Due:', formatCurrencyPdf(invoice.balance_due), true);

  // Payment Status Badge
  y += 3;
  const statusLabel = getPaymentStatusLabel(invoice.payment_status);
  const statusColor = getPaymentStatusColor(invoice.payment_status);
  doc.setFillColor(...statusColor);
  const badgeWidth = doc.getTextWidth(statusLabel) + 12;
  doc.roundedRect(totalsValX - badgeWidth, y - 4, badgeWidth, 7, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, totalsValX - badgeWidth / 2, y, { align: 'center' });

  // ─── Notes ───────────────────────────────────────────────
  if (invoice.notes) {
    y += 15;
    doc.setTextColor(80, 80, 90);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
  }

  // ─── Footer ──────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setTextColor(150, 150, 160);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
  doc.text(
    `Generated by SteelWorks Manager • ${new Date().toLocaleDateString('en-IN')}`,
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );

  return doc.output('blob');
}

/**
 * Downloads the invoice PDF directly.
 */
export async function downloadInvoicePdf(
  invoice: Invoice,
  workshop: WorkshopInfo | null
): Promise<void> {
  const blob = await generateInvoicePdfBlob(invoice, workshop);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoice_number}-${invoice.customer_name.replace(/\s+/g, '-')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Triggers the browser print dialog directly for the invoice PDF.
 */
export async function printInvoicePdf(
  invoice: Invoice,
  workshop: WorkshopInfo | null
): Promise<void> {
  const blob = await generateInvoicePdfBlob(invoice, workshop);
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
    });
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Print window was closed or blocked
      }
    }, 500);
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 60000);
      }, 300);
    };
  }
}

/**
 * Opens WhatsApp with a share message for the invoice.
 * No print button — strictly WhatsApp share.
 */
export function shareInvoiceOnWhatsApp(invoice: Invoice, workshop: WorkshopInfo | null): void {
  const phone = invoice.customer_phone?.replace(/[^0-9+]/g, '') ?? '';
  const workshopName = workshop?.name || 'SteelWorks Workshop';
  const message = encodeURIComponent(
    `Hello ${invoice.customer_name},\n\n` +
    `Here is your invoice from ${workshopName}:\n\n` +
    `📋 Invoice: ${invoice.invoice_number}\n` +
    `📦 Order: ${invoice.order_title}\n` +
    `💰 Total: ₹${invoice.grand_total.toLocaleString('en-IN')}\n` +
    `✅ Paid: ₹${invoice.total_paid.toLocaleString('en-IN')}\n` +
    `📊 Balance: ₹${invoice.balance_due.toLocaleString('en-IN')}\n` +
    `📅 Date: ${formatInvDate(invoice.invoice_date)}\n\n` +
    `Thank you for your business!\n— ${workshopName}`
  );

  const whatsappUrl = phone
    ? `https://wa.me/${phone.startsWith('+') ? phone.slice(1) : phone}?text=${message}`
    : `https://wa.me/?text=${message}`;

  window.open(whatsappUrl, '_blank');
}

// ─── Helpers ───────────────────────────────────────────────

function formatCurrencyPdf(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatInvDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'paid': return 'PAID';
    case 'partially_paid': return 'PARTIALLY PAID';
    default: return 'UNPAID';
  }
}

function getPaymentStatusColor(status: string): [number, number, number] {
  switch (status) {
    case 'paid': return [16, 185, 129]; // emerald
    case 'partially_paid': return [245, 158, 11]; // amber
    default: return [239, 68, 68]; // red
  }
}
