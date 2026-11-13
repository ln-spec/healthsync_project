"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadFile } from "@/lib/api";

type Format = "xlsx" | "csv";

/** Current month in Manila (UTC+8) as YYYY-MM, matching the backend's default. */
function currentMonth(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 7);
}

export default function MonthlyReportButton() {
  const [month, setMonth] = useState(currentMonth);
  const [format, setFormat] = useState<Format>("xlsx");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function exportReport() {
    if (!month) { setMessage({ tone: "error", text: "Choose a reporting month first." }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const filename = await downloadFile(`/reports/monthly?month=${encodeURIComponent(month)}&format=${format}`, `healthsync-monthly-report-${month}.${format}`);
      setMessage({ tone: "ok", text: `Downloaded ${filename}` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Report export failed." });
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-7 rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2"><FileSpreadsheet className="text-blue" size={20}/><h2 className="text-lg font-bold">Monthly report export</h2></div>
        <p className="mt-1 max-w-xl text-sm text-black/60">Consultations by age group, top diagnoses, vaccination compliance and medicine consumption for your facility, ready for administrative submission.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-medium text-black/60">Month
          <input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} disabled={busy} className="mt-1 block rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-blue"/>
        </label>
        <label className="block text-xs font-medium text-black/60">Format
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)} disabled={busy} className="mt-1 block rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-blue">
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
        </label>
        <button type="button" onClick={exportReport} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue/90 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>}{busy ? "Preparing…" : "Export report"}
        </button>
      </div>
    </div>
    {message && <p role="status" className={`mt-4 text-sm ${message.tone === "error" ? "text-red-700" : "text-black/60"}`}>{message.text}</p>}
  </section>;
}
