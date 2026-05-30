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
