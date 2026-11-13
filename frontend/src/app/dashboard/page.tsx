"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Search,
  ShieldCheck,
  Users,
  Warehouse,
} from "lucide-react";
import {
  api,
  type InventoryItem,
  type Patient,
  type PublicHealthAnalytics,
  type TodayVisitCount,
} from "@/lib/api";
import AuthControl from "@/components/AuthControl";
import EntryForms from "@/components/EntryForms";

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<PublicHealthAnalytics | null>(
    null,
  );
  const [visitsToday, setVisitsToday] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const loadAllPatients = useCallback(async () => {
    const all: Patient[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const page = await api<Patient[]>(
        `/patients?limit=${pageSize}&offset=${offset}`,
      );
      all.push(...page);
      if (page.length < pageSize) return all;
    }
  }, []);
  const refresh = useCallback(() => {
    Promise.allSettled([
      loadAllPatients(),
      api<InventoryItem[]>("/inventory"),
      api<PublicHealthAnalytics>("/analytics/public-health?days=30"),
      api<TodayVisitCount>("/analytics/visits/today"),
    ]).then(
      ([patientResult, inventoryResult, analyticsResult, todayResult]) => {
        const errors: string[] = [];
        if (patientResult.status === "fulfilled")
          setPatients(patientResult.value);
        else {
          setPatients([]);
          errors.push(`Patient records: ${errorMessage(patientResult.reason)}`);
        }
        if (inventoryResult.status === "fulfilled")
          setInventory(inventoryResult.value);
        else {
          setInventory([]);
          errors.push(
            `Medicine inventory: ${errorMessage(inventoryResult.reason)}`,
          );
        }
        if (analyticsResult.status === "fulfilled") {
          setAnalytics(analyticsResult.value);
          setAnalyticsError("");
        } else {
          setAnalytics(null);
          setAnalyticsError(errorMessage(analyticsResult.reason));
        }
        if (todayResult.status === "fulfilled")
          setVisitsToday(todayResult.value.count);
        else {
          setVisitsToday(null);
          errors.push(`Visits today: ${errorMessage(todayResult.reason)}`);
        }
        setError(errors.join(" · "));
      },
    );
  }, [loadAllPatients]);
  useEffect(() => {
    refresh();
    window.addEventListener("healthsync-auth-change", refresh);
    return () => window.removeEventListener("healthsync-auth-change", refresh);
  }, [refresh]);
  const filtered = patients.filter((patient) =>
    patient.full_name.toLowerCase().includes(search.toLowerCase()),
  );
  const lowStock = inventory.filter(
    (item) => item.stock_quantity <= item.reorder_threshold,
  );

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-blue/20 bg-blue">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-white"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-canvas text-blue">
              <Activity size={19} />
            </span>
            HealthSync
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/80 sm:block">
              Barangay health workspace
            </span>
            <div className="relative">
              <button
                aria-label={`Low stock notifications: ${lowStock.length}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative grid size-10 place-items-center rounded-full bg-canvas text-blue hover:bg-white"
              >
                <Bell size={18} />
                {lowStock.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-blue px-1 text-[10px] font-bold text-white">
                    {lowStock.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <section className="absolute right-0 z-30 mt-3 w-80 rounded-2xl border border-black/10 bg-canvas p-4 text-black shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Medicine notifications</h2>
                      <p className="mt-1 text-xs text-black/60">
                        Items at or below reorder level
                      </p>
                    </div>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      aria-label="Close notifications"
                      className="rounded-lg px-2 py-1 text-sm text-blue hover:bg-white"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                    {lowStock.length ? (
                      lowStock.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3 py-2.5"
                        >
                          <span className="truncate text-sm font-medium">
                            {item.medicine_name}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-blue">
                            {item.stock_quantity} left
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl bg-white p-3 text-sm text-black/60">
                        No low stock alerts.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
            <AuthControl inverse showSignUp={false} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-teal">Community care</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Good day!
            </h1>
            <p className="mt-2 text-sm text-black/60">
              Here’s what needs your attention.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-canvas px-3 py-2 text-xs text-black/60">
            <ShieldCheck size={15} className="text-teal" /> Secure facility view
          </span>
        </div>
        {error && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-blue/20 bg-canvas p-4 text-sm text-black"
          >
            {error}
          </div>
        )}
        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<Users />}
            label="Patient records"
            value={String(patients.length)}
            detail="Recent records"
          />
          <Stat
            icon={<Warehouse />}
            label="Medicine types"
            value={String(inventory.length)}
            detail="Available in facility"
          />
          <Stat
            icon={<Activity />}
            label="Visits today"
            value={visitsToday === null ? "—" : String(visitsToday)}
            detail="Visit date · Manila time"
          />
          <Stat
            icon={<Users />}
            label="Patients seen"
            value={analytics ? String(analytics.unique_patients) : "—"}
            detail="Unique patients · last 30 days"
          />
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Patient lookup</h2>
                <p className="mt-1 text-sm text-black/60">
                  Search your facility’s patient directory.
                </p>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40"
                  size={17}
                />
                <input
                  aria-label="Search patients"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name"
                  className="w-56 rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal"
                />
              </div>
            </div>
            <div className="mt-5 divide-y divide-black/10">
              {filtered.length ? (
                filtered.map((patient) => (
                  <Link
                    href={`/patients/${patient.id}`}
                    key={patient.id}
                    className="flex items-center justify-between py-4 hover:bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-mint font-semibold text-teal">
                        {patient.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold">{patient.full_name}</p>
                        <p className="text-xs text-black/60">
                          DOB {patient.dob} · {patient.gender}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight size={18} className="text-black/40" />
                  </Link>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-black/60">
                  {error
                    ? "Patient data unavailable"
                    : "No matching patient records"}
                </p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Available medicine</h2>
                <p className="mt-1 text-sm text-black/60">
                  Current facility stock counts
                </p>
              </div>
              <Warehouse className="text-teal" />
            </div>
            <div className="mt-5 max-h-80 space-y-2 overflow-y-auto">
              {inventory.length ? (
                inventory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.medicine_name}
                      </p>
                      <p className="mt-1 text-xs text-black/60">
                        Reorder level: {item.reorder_threshold}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${item.stock_quantity <= item.reorder_threshold ? "bg-blue/10 text-blue" : "bg-canvas text-black"}`}
                    >
                      {item.stock_quantity} in stock
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-white p-4 text-sm text-black/60">
                  {error
                    ? "Inventory data unavailable"
                    : "No medicine has been added yet."}
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-7 rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Recent patient visits</h2>
              <p className="mt-1 text-sm text-black/60">
                Latest recorded visits at your facility.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue">
              Visit feed
            </span>
          </div>
          <div className="mt-4 divide-y divide-black/10">
            {analytics?.recent_visits.length ? (
              analytics.recent_visits.map((visit) => (
                <Link
                  key={visit.id}
                  href={`/patients/${visit.patient_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-white"
                >
                  <div>
                    <p className="font-semibold">{visit.patient_name}</p>
                    <p className="mt-1 text-sm text-black/60">
                      {visit.diagnosis}
                    </p>
                  </div>
                  <time className="text-xs text-black/60">
                    {new Date(visit.visit_date).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </Link>
              ))
            ) : (
              <p className="rounded-xl bg-white p-4 text-sm text-black/60">
                {error
                  ? "Visit data unavailable."
                  : "No visits have been recorded in the last 30 days."}
              </p>
            )}
          </div>
        </section>

        <EntryForms onSaved={refresh} />
        <PublicHealthPanel
          analytics={analytics}
          analyticsError={analyticsError}
        />
      </div>
    </main>
  );
}

function PublicHealthPanel({
  analytics,
  analyticsError,
}: {
  analytics: PublicHealthAnalytics | null;
  analyticsError: string;
}) {
  const peak = Math.max(
    1,
    ...(analytics?.weekly_visits.map((week) => week.count) ?? []),
  );
  return (
    <section className="mt-7 rounded-2xl border border-blue/20 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue">
            Facility overview · last 30 days
          </p>
          <h2 className="mt-1 text-2xl font-bold">
            Public Health Monitoring &amp; Analytics
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
            Review visit patterns and changes in recorded diagnoses to help
            identify trends that may need follow-up.
          </p>
        </div>
        <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-black/70">
          Facility data
        </span>
      </div>
      {analyticsError ? (
        <p
          role="status"
          className="mt-6 rounded-xl bg-canvas p-4 text-sm text-black/70"
        >
          Analytics request failed: {analyticsError}
        </p>
      ) : !analytics ? (
        <p className="mt-6 rounded-xl bg-canvas p-4 text-sm text-black/60">
          Loading facility analytics…
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Summary
              label="Visits this period"
              value={analytics.current_visits}
              detail={`${analytics.previous_visits} in the previous 30 days`}
            />
            <Summary
              label="Unique patients"
              value={analytics.unique_patients}
              detail={`${analytics.previous_unique_patients} in the previous 30 days`}
            />
            <Summary
              label="Diagnosis categories"
              value={analytics.diagnosis_categories}
              detail="Based on visit records"
            />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-black/10 bg-canvas p-5">
              <h3 className="font-semibold">Weekly visit activity</h3>
              <p className="mt-1 text-xs text-black/60">
                Visits grouped by week
              </p>
              {analytics.weekly_visits.length ? (
                <div className="mt-5 flex h-36 items-end gap-2">
                  {analytics.weekly_visits.map((week) => (
                    <div
                      key={week.week_start}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                      <span className="text-[10px] font-medium text-black/70">
                        {week.count}
                      </span>
                      <div
                        className="w-full max-w-10 rounded-t-md bg-blue"
                        style={{
                          height: `${Math.max(5, (week.count / peak) * 100)}%`,
                        }}
                      />
                      <span className="text-[9px] text-black/60">
                        {new Date(
                          `${week.week_start}T12:00:00`,
                        ).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-black/60">
                  No visits recorded during this period.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-black/10 bg-canvas p-5">
              <h3 className="font-semibold">Most recorded diagnoses</h3>
              <p className="mt-1 text-xs text-black/60">
                Compared with the previous 30 days
              </p>
              <div className="mt-4 space-y-3">
                {analytics.diagnoses.length ? (
                  analytics.diagnoses.slice(0, 5).map((diagnosis) => (
                    <div key={diagnosis.name}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">
                          {diagnosis.name}
                        </span>
                        <span className="shrink-0 text-xs text-black/60">
                          {diagnosis.count} · was {diagnosis.previous_count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-blue"
                          style={{
                            width: `${Math.max(4, (diagnosis.count / Math.max(1, analytics.diagnoses[0].count)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-black/60">
                    No diagnoses recorded during this period.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-blue/20 bg-canvas p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Increased reports for review</h3>
                <p className="mt-1 text-xs text-black/60">
                  Conditions with at least 3 visits and a marked increase from
                  the prior period.
                </p>
              </div>
              <Activity className="shrink-0 text-blue" size={20} />
            </div>
            {analytics.increased_reports.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {analytics.increased_reports.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-blue">
                      {item.count} visits · was {item.previous_count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-black/60">
                No diagnosis counts meet this review threshold.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs leading-5 text-black/50">
            These are facility-recording trends, not confirmed outbreaks or
            diagnoses. Reporting gaps and changes in data entry can affect the
            counts. Review signals with a qualified public health professional.
          </p>
          {analytics.record_limit_reached && (
            <p className="mt-2 text-xs font-medium text-blue">
              Analytics are based on the most recent 5,000 records in the
              selected window.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Summary({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-canvas p-4">
      <p className="text-sm text-black/60">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-black/50">{detail}</p>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-canvas p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-black/60">{label}</span>
        <span className="text-teal">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-black/40">{detail}</p>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown request error";
}
