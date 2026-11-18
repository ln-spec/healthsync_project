"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, Building2, RefreshCw, ShieldCheck, Users, Warehouse } from "lucide-react";
import AuthControl from "@/components/AuthControl";
import { api, type MunicipalDashboard } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

export default function MunicipalPage() {
  const [dashboard, setDashboard] = useState<MunicipalDashboard | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      const session = data.session;
      if (!session) {
        setDashboard(null);
        setError("Log in with your municipal health office account to continue.");
        return;
      }
      if (session.user.app_metadata?.facility_role !== "municipal_admin") {
        window.location.replace("/dashboard");
        return;
      }
      setDashboard(await api<MunicipalDashboard>(`/municipal/dashboard?days=${days}`));
    } catch (cause) {
      setDashboard(null);
      setError(cause instanceof Error ? cause.message : "Municipal dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
    window.addEventListener("healthsync-auth-change", load);
    return () => window.removeEventListener("healthsync-auth-change", load);
  }, [load]);

  const peakVisits = Math.max(1, ...(dashboard?.public_health.weekly_visits.map((week) => week.count) ?? []));

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-blue/20 bg-blue text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-blue"><Activity size={20}/></span>
            <div><p className="text-lg font-bold">HealthSync</p><p className="text-xs text-white/75">Municipal health office</p></div>
          </div>
          <div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-white/25 px-3 py-2 text-xs sm:flex"><ShieldCheck size={14}/> Municipality-wide aggregate view</span><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh municipal dashboard" className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-60"><RefreshCw size={17} className={loading ? "animate-spin" : ""}/></button><AuthControl inverse showSignUp={false}/></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-semibold text-blue">MHO overview</p><h1 className="mt-1 text-3xl font-bold">{dashboard?.municipality_name ?? "Municipal dashboard"}</h1><p className="mt-2 text-sm text-black/60">Patient population, public health trends, and medicine availability across your barangays.</p></div>
          <label className="text-xs font-semibold text-black/60">Analytics period<select value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-2 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink"><option value={30}>Last 30 days</option><option value={60}>Last 60 days</option><option value={90}>Last 90 days</option></select></label>
        </div>

        {error && <div role="status" className="mt-6 rounded-xl border border-blue/20 bg-white p-4 text-sm text-black/80">{error}</div>}
        {loading && !dashboard && <p className="mt-6 rounded-xl bg-white p-5 text-sm text-black/60">Loading municipality aggregates…</p>}

        {dashboard && <>
          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<Users/>} label="Patients registered" value={dashboard.patient_counts.total} detail="Across mapped barangays"/>
            <SummaryCard icon={<Building2/>} label="Barangay facilities" value={dashboard.facility_count} detail="Active in this municipality"/>
            <SummaryCard icon={<Activity/>} label={`Visits · ${days} days`} value={dashboard.public_health.current_visits} detail={`${dashboard.public_health.previous_visits} in the previous period`}/>
            <SummaryCard icon={<Warehouse/>} label="Low-stock medicines" value={dashboard.low_stock_count} detail="At or below reorder level"/>
          </section>

          <section className="mt-7 rounded-2xl border border-black/10 bg-white p-6 shadow-card">
            <div><p className="text-sm font-semibold text-blue">Population</p><h2 className="mt-1 text-xl font-bold">Patient counts by age group</h2><p className="mt-1 text-sm text-black/60">Age brackets match the barangay patient labels.</p></div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{dashboard.patient_counts.by_age_group.map((group) => <div key={group.type} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3"><span className="text-sm font-medium">{group.type}</span><span className="rounded-full bg-blue/10 px-3 py-1 text-sm font-bold text-blue">{group.count.toLocaleString()}</span></div>)}</div>
              <div className="overflow-hidden rounded-xl border border-black/10"><div className="grid grid-cols-[1fr_auto] bg-canvas px-4 py-3 text-xs font-semibold uppercase tracking-wide text-black/60"><span>Barangay</span><span>Patients</span></div><div className="max-h-72 divide-y divide-black/5 overflow-y-auto">{dashboard.patient_counts.by_barangay.length ? dashboard.patient_counts.by_barangay.map((row) => <div key={row.facility_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span>{row.barangay_name}</span><span className="font-semibold">{row.count.toLocaleString()}</span></div>) : <p className="p-4 text-sm text-black/60">No patient records in mapped barangays.</p>}</div></div>
            </div>
          </section>

          <section className="mt-7 rounded-2xl border border-black/10 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-blue">Municipal public health</p><h2 className="mt-1 text-xl font-bold">Public Health Monitoring &amp; Analytics</h2><p className="mt-1 text-sm text-black/60">Aggregated visits and recorded diagnosis trends across mapped barangays.</p></div><span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-black/70">{days}-day reporting period</span></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3"><MiniStat label="Unique patients" value={dashboard.public_health.unique_patients} detail={`${dashboard.public_health.previous_unique_patients} in previous period`}/><MiniStat label="Diagnosis categories" value={dashboard.public_health.diagnosis_categories} detail="Current period"/><MiniStat label="Visits" value={dashboard.public_health.current_visits} detail={`${dashboard.public_health.previous_visits} in previous period`}/></div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl bg-canvas p-5"><h3 className="font-semibold">Weekly visit activity</h3>{dashboard.public_health.weekly_visits.length ? <div className="mt-5 flex h-40 items-end gap-2">{dashboard.public_health.weekly_visits.map((week) => <div key={week.week_start} title={`${week.week_start}: ${week.count} visits`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] text-black/70">{week.count}</span><div className="w-full max-w-12 rounded-t-md bg-blue" style={{height: `${Math.max(5, week.count / peakVisits * 100)}%`}}/><span className="text-[9px] text-black/60">{new Date(`${week.week_start}T12:00:00`).toLocaleDateString("en-PH", {month:"short", day:"numeric"})}</span></div>)}</div> : <p className="mt-4 text-sm text-black/60">No visits in this period.</p>}</div>
              <div className="rounded-xl bg-canvas p-5"><h3 className="font-semibold">Most recorded diagnoses</h3><div className="mt-3 divide-y divide-black/10">{dashboard.public_health.diagnoses.length ? dashboard.public_health.diagnoses.map((diagnosis) => <div key={diagnosis.name} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="truncate">{diagnosis.name}</span><span className="shrink-0 font-semibold">{diagnosis.count}{diagnosis.change_percent !== null && <span className={`ml-2 text-xs ${diagnosis.change_percent > 0 ? "text-blue" : "text-black/50"}`}>{diagnosis.change_percent > 0 ? "+" : ""}{diagnosis.change_percent}%</span>}</span></div>) : <p className="py-4 text-sm text-black/60">No diagnosis records in this period.</p>}</div></div>
            </div>
            {dashboard.public_health.increased_reports.length > 0 && <div className="mt-5 rounded-xl border border-blue/20 bg-blue/5 p-4"><h3 className="font-semibold text-blue">Reports with notable increases</h3><p className="mt-1 text-xs text-black/60">These are signals for review, not confirmed outbreaks.</p><div className="mt-3 flex flex-wrap gap-2">{dashboard.public_health.increased_reports.map((report) => <span key={report.name} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold">{report.name} · {report.count}</span>)}</div></div>}
            <p className="mt-4 text-xs text-black/50">Counts are aggregated; this view does not show patient identities or individual records.</p>
          </section>

          <section className="mt-7 rounded-2xl border border-black/10 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-blue">Medicine supply</p><h2 className="mt-1 text-xl font-bold">Inventory across barangays</h2><p className="mt-1 text-sm text-black/60">On-hand counts compared with each barangay’s reorder level.</p></div><span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold">{dashboard.inventory.length} stock entries</span></div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-black/10"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-canvas text-xs uppercase tracking-wide text-black/60"><tr><th className="px-4 py-3">Barangay</th><th className="px-4 py-3">Medicine</th><th className="px-4 py-3">In stock</th><th className="px-4 py-3">Reorder level</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-black/5">{dashboard.inventory.length ? dashboard.inventory.map((item) => <tr key={`${item.facility_id}-${item.medicine_name}`}><td className="px-4 py-3">{item.barangay_name}</td><td className="px-4 py-3 font-medium">{item.medicine_name}</td><td className="px-4 py-3">{item.stock_quantity}</td><td className="px-4 py-3">{item.reorder_threshold}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.low_stock ? "bg-blue/10 text-blue" : "bg-canvas text-black/60"}`}>{item.low_stock ? "Low stock" : "Available"}</span></td></tr>) : <tr><td colSpan={5} className="px-4 py-8 text-center text-black/60">No inventory entries in mapped barangays.</td></tr>}</tbody></table></div>
          </section>
          <p className="mt-4 text-right text-xs text-black/40">Updated {new Date(dashboard.generated_at).toLocaleString("en-PH")}</p>
        </>}
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail: string }) {
  return <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-card"><div className="flex items-start justify-between"><p className="text-sm font-medium text-black/60">{label}</p><span className="text-blue">{icon}</span></div><p className="mt-4 text-3xl font-bold">{value.toLocaleString()}</p><p className="mt-1 text-xs text-black/50">{detail}</p></section>;
}

function MiniStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl bg-canvas p-4"><p className="text-xs font-medium text-black/60">{label}</p><p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p><p className="mt-1 text-xs text-black/50">{detail}</p></div>;
}
