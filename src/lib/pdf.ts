import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadPayslip(p: {
  id: string;
  workerName: string;
  workerRole?: string | null;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  bonus: number;
  deductions: number;
  netAmount: number;
  hoursWorked: number;
  status: string;
}) {
  const doc = new jsPDF();
  doc.setFillColor(15, 12, 41);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("TrackNova", 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(120, 200, 255);
  doc.text("Salary Slip", 14, 22);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.text(`Employee: ${p.workerName}`, 14, 44);
  doc.text(`Role: ${p.workerRole ?? "—"}`, 14, 50);
  doc.text(`Period: ${p.periodStart} → ${p.periodEnd}`, 14, 56);
  doc.text(`Slip ID: ${p.id.slice(0, 8).toUpperCase()}`, 14, 62);
  doc.text(`Status: ${p.status}`, 150, 44);

  autoTable(doc, {
    startY: 72,
    head: [["Component", "Amount (INR)"]],
    body: [
      ["Base salary", p.baseAmount.toLocaleString("en-IN")],
      ["Bonus", p.bonus.toLocaleString("en-IN")],
      ["Hours worked", p.hoursWorked.toString()],
      ["Deductions", `- ${p.deductions.toLocaleString("en-IN")}`],
      [
        { content: "NET PAY", styles: { fontStyle: "bold" } },
        {
          content: `INR ${p.netAmount.toLocaleString("en-IN")}`,
          styles: { fontStyle: "bold", textColor: [16, 110, 180] },
        },
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 30, 60], textColor: [200, 220, 255] },
    styles: { fontSize: 10 },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Computer generated payslip — TrackNova Enterprise. Confidential.",
    14,
    285,
  );
  doc.save(`payslip-${p.workerName.replace(/\s+/g, "_")}-${p.periodEnd}.pdf`);
}

export function downloadReport(title: string, sections: { heading: string; rows: (string | number)[][]; head: string[] }[]) {
  const doc = new jsPDF();
  doc.setFillColor(15, 12, 41);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("TrackNova", 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(120, 200, 255);
  doc.text(title, 14, 22);

  let y = 38;
  for (const s of sections) {
    doc.setTextColor(20);
    doc.setFontSize(12);
    doc.text(s.heading, 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [s.head],
      body: s.rows.map((r) => r.map(String)),
      headStyles: { fillColor: [30, 30, 60], textColor: [200, 220, 255] },
      styles: { fontSize: 9 },
    });
    // @ts-expect-error lastAutoTable comes from autotable plugin
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 12;
    if (y > 250) { doc.addPage(); y = 20; }
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function downloadInvoice(p: {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  status: string;
  company: { name: string; address?: string | null; email?: string | null; phone?: string | null; logoUrl?: string | null; currency?: string };
  client: { name: string; company?: string | null; email?: string | null; address?: string | null };
  items: { description: string; quantity: number; unit_price: number; amount: number }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
}) {
  const doc = new jsPDF();
  const currency = p.company.currency || "USD";
  doc.setFillColor(15, 12, 41);
  doc.rect(0, 0, 210, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(p.company.name, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(180, 220, 255);
  if (p.company.address) doc.text(p.company.address, 14, 24);
  if (p.company.email) doc.text(p.company.email, 14, 30);

  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", 196, 16, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(180, 220, 255);
  doc.text(`# ${p.invoiceNumber}`, 196, 24, { align: "right" });
  doc.text(`Status: ${p.status}`, 196, 30, { align: "right" });

  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.text("Bill To", 14, 50);
  doc.setFontSize(11);
  doc.text(p.client.name, 14, 56);
  if (p.client.company) doc.text(p.client.company, 14, 62);
  if (p.client.email) doc.text(p.client.email, 14, 68);

  doc.setFontSize(10);
  doc.text(`Issue Date: ${p.issueDate}`, 196, 50, { align: "right" });
  if (p.dueDate) doc.text(`Due Date: ${p.dueDate}`, 196, 56, { align: "right" });

  autoTable(doc, {
    startY: 80,
    head: [["Description", "Qty", `Unit (${currency})`, `Amount (${currency})`]],
    body: p.items.map((i) => [
      i.description,
      i.quantity.toString(),
      i.unit_price.toFixed(2),
      i.amount.toFixed(2),
    ]),
    headStyles: { fillColor: [30, 30, 60], textColor: [200, 220, 255] },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  // @ts-expect-error autotable plugin
  let y = (doc.lastAutoTable?.finalY ?? 120) + 10;
  doc.setFontSize(10);
  doc.text(`Subtotal: ${currency} ${p.subtotal.toFixed(2)}`, 196, y, { align: "right" });
  y += 6;
  doc.text(`Tax (${p.taxRate}%): ${currency} ${p.taxAmount.toFixed(2)}`, 196, y, { align: "right" });
  y += 8;
  doc.setFontSize(13);
  doc.setTextColor(16, 110, 180);
  doc.text(`TOTAL: ${currency} ${p.total.toFixed(2)}`, 196, y, { align: "right" });

  if (p.notes) {
    doc.setTextColor(80);
    doc.setFontSize(9);
    doc.text("Notes:", 14, y + 14);
    doc.text(p.notes, 14, y + 20, { maxWidth: 170 });
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Thank you for your business.", 14, 285);
  doc.save(`invoice-${p.invoiceNumber}.pdf`);
}

export function downloadInsightsBrief(title: string, body: string) {
  const doc = new jsPDF();
  doc.setFillColor(15, 12, 41);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("TrackNova", 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(120, 200, 255);
  doc.text(title, 14, 22);
  doc.setTextColor(20);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(body, 180);
  doc.text(lines, 14, 44);
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
