"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  FileSpreadsheet,
  MapPin,
  Search,
  Users,
  Warehouse,
} from "lucide-react";
import {
  api,
  type FacilityInfo,
  type InventoryItem,
  type Patient,
  type PublicHealthAnalytics,
  type TodayVisitCount,
} from "@/lib/api";
import AuthControl from "@/components/AuthControl";
import EntryForms from "@/components/EntryForms";
import MonthlyReportButton from "@/components/MonthlyReportButton";
import { getPatientAgeGroup } from "@/lib/patientAgeGroup";
import { getSupabaseClient } from "@/lib/supabase";

const PATIENT_PAGE_SIZE = 50;

export default function DashboardPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientTotal, setPatientTotal] = useState<number | null>(null);
  const [patientOffset, setPatientOffset] = useState(0);
  const [patientHasMore, setPatientHasMore] = useState(false);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState("");
  const [patientCountError, setPatientCountError] = useState("");
  const [patientReloadKey, setPatientReloadKey] = useState(0);
  const [canLoadPatients, setCanLoadPatients] = useState(false);
  const [barangayName, setBarangayName] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<PublicHealthAnalytics | null>(
    null,
  );
  const [visitsToday, setVisitsToday] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const patientListRef = useRef<HTMLDivElement>(null);
  const patientRequestId = useRef(0);
  const patientPageLoading = useRef(false);
  const loadFirstPatientPage = useCallback(async (query: string) => {
    const requestId = ++patientRequestId.current;
    patientPageLoading.current = true;
    setPatientLoading(true);
    setPatientError("");
    setPatients([]);
    setPatientOffset(0);
    setPatientHasMore(false);
    patientListRef.current?.scrollTo(0, 0);
    try {
      const params = new URLSearchParams({ limit: String(PATIENT_PAGE_SIZE), offset: "0" });
      if (query.trim()) params.set("q", query.trim());
      const pageRequest = api<Patient[]>(`/patients?${params.toString()}`);
      let page: Patient[];
      let totalCount: number | undefined;
      if (query.trim()) {
        page = await pageRequest;
      } else {
        const [firstPageResult, totalResult] = await Promise.allSettled([
          pageRequest,
          api<{ count: number }>("/patients/count"),
        ]);
        if (firstPageResult.status === "rejected") throw firstPageResult.reason;
        page = firstPageResult.value;
        if (totalResult.status === "fulfilled") {
          totalCount = totalResult.value.count;
          setPatientCountError("");
        } else {
          setPatientCountError(errorMessage(totalResult.reason));
        }
      }
      if (requestId !== patientRequestId.current) return;
      setPatients(page);
      if (totalCount !== undefined) setPatientTotal(totalCount);
      setPatientOffset(page.length);
      setPatientHasMore(page.length === PATIENT_PAGE_SIZE);
    } catch (cause) {
      if (requestId === patientRequestId.current) {
        setPatients([]);
        setPatientError(errorMessage(cause));
      }
    } finally {
      if (requestId === patientRequestId.current) {
        patientPageLoading.current = false;
        setPatientLoading(false);
      }
    }
  }, []);
  const loadMorePatients = useCallback(async () => {
    if (!canLoadPatients || patientPageLoading.current || !patientHasMore) return;
    const requestId = patientRequestId.current;
    patientPageLoading.current = true;
    setPatientLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PATIENT_PAGE_SIZE),
        offset: String(patientOffset),
      });
      if (search.trim()) params.set("q", search.trim());
      const page = await api<Patient[]>(`/patients?${params.toString()}`);
      if (requestId !== patientRequestId.current) return;
      setPatients((current) => [...current, ...page]);
      setPatientOffset((current) => current + page.length);
      setPatientHasMore(page.length === PATIENT_PAGE_SIZE);
    } catch (cause) {
      if (requestId === patientRequestId.current) setPatientError(errorMessage(cause));
    } finally {
      if (requestId === patientRequestId.current) {
        patientPageLoading.current = false;
        setPatientLoading(false);
      }
    }
  }, [canLoadPatients, patientHasMore, patientOffset, search]);
  const refresh = useCallback(() => {
    setPatientReloadKey((current) => current + 1);
    Promise.allSettled([
      api<InventoryItem[]>("/inventory"),
      api<PublicHealthAnalytics>("/analytics/public-health?days=30"),
      api<TodayVisitCount>("/analytics/visits/today"),
    ]).then(
      ([inventoryResult, analyticsResult, todayResult]) => {
        const errors: string[] = [];
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
  }, []);
  const onPatientSaved = useCallback(() => {
    setSearch("");
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!canLoadPatients) return;
    patientRequestId.current += 1;
    patientPageLoading.current = false;
    setPatientLoading(false);
    setPatients([]);
    setPatientOffset(0);
    setPatientHasMore(false);
    const timer = window.setTimeout(() => {
      void loadFirstPatientPage(search);
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [canLoadPatients, loadFirstPatientPage, patientReloadKey, search]);
  useEffect(() => {
    let active = true;
    const routeByRole = () => {
      void getSupabaseClient().auth.getSession().then(({ data }) => {
        if (!active) return;
        if (data.session?.user.app_metadata?.facility_role === "municipal_admin") {
          router.replace("/municipal");
          return;
        }
        if (!data.session) {
          patientRequestId.current += 1;
          setCanLoadPatients(false);
          setPatients([]);
          setPatientTotal(null);
          setPatientCountError("");
          return;
        }
        setCanLoadPatients(true);
        void api<FacilityInfo>("/facility")
          .then((facility) => setBarangayName(facility.barangay_name))
          .catch(() => setBarangayName(""));
        refresh();
      });
    };
    routeByRole();
    window.addEventListener("healthsync-auth-change", routeByRole);
    return () => {
      active = false;
      window.removeEventListener("healthsync-auth-change", routeByRole);
    };
  }, [refresh, router]);
  const lowStock = inventory.filter(
    (item) => item.stock_quantity <= item.reorder_threshold,
  );

  return (
    <main className="min-h-screen bg-white">
      <header className="relative z-50 border-b border-blue/20 bg-blue">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6">
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
            {barangayName && (
              <div
                title={barangayName}
                className="hidden items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-blue shadow-sm sm:flex"
              >
                <MapPin className="shrink-0 text-accent" size={17} />
                <div className="leading-tight">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-black/50">
                    Assigned barangay
                  </p>
                  <p className="max-w-40 truncate text-sm font-bold">
                    {barangayName}
                  </p>
                </div>
              </div>
            )}
            <div className="relative">
              <button
                aria-label={`Low stock notifications: ${lowStock.length}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative grid size-10 place-items-center rounded-full bg-canvas text-blue hover:bg-white"
              >
                <Bell size={18} />
                {lowStock.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent-strong px-1 text-[10px] font-bold text-white">
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
                      className="rounded-lg px-2 py-1 text-sm text-accent-strong hover:bg-white"
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
                          <span className="shrink-0 text-xs font-semibold text-accent-strong">
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
          </div>
        </div>
      </header>

      <aside className="mb-6 rounded-2xl border border-black/10 bg-canvas p-4 shadow-card lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:mb-0 lg:flex lg:w-56 lg:flex-col lg:overflow-y-auto lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:p-4 lg:shadow-none">
        <Link
          href="/"
          className="mb-5 hidden items-center gap-2.5 border-b border-black/10 pb-4 lg:flex"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-blue/10 text-blue">
            <Activity size={17} />
          </span>
          <span className="text-base font-bold text-blue">HealthSync</span>
        </Link>
        <nav
          aria-label="Dashboard sections"
          className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-3 lg:overflow-visible"
        >
          {[
            { id: "patient-records", label: "Patient records", icon: <Users size={17} /> },
            { id: "patient-lookup", label: "Patient lookup & available medicine", icon: <Search size={17} /> },
            { id: "recent-visits", label: "Recent patient visits", icon: <Activity size={17} /> },
            { id: "facility-overview", label: "Facility overview", icon: <Warehouse size={17} /> },
            { id: "monthly-report", label: "Monthly report export", icon: <FileSpreadsheet size={17} /> },
          ].map(({ id, label, icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="group flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-black/70 transition hover:border-accent/40 hover:bg-accent/[0.14] hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong lg:w-full lg:whitespace-normal lg:px-3 lg:py-2.5"
            >
              <span className="shrink-0 text-accent transition group-hover:text-accent">
                {icon}
              </span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="mt-4 border-t border-black/10 pt-4 lg:mt-auto">
          <AuthControl showSignUp={false} />
        </div>
      </aside>

      <div className="mx-auto max-w-7xl px-6 py-9 lg:ml-64 lg:mr-auto">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-accent-strong">Community care</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">
                  Hi! Health Worker.
                </h1>
                <p className="mt-2 text-sm text-black/60">
                  How may I help you today?
                </p>
              </div>
              <EntryForms onSaved={onPatientSaved} />
            </div>
            {error && (
              <div
                role="status"
                className="mt-6 rounded-xl border border-accent/40 bg-canvas p-4 text-sm text-black"
              >
                {error}
              </div>
            )}
            <section
              id="patient-records"
              className="mt-7 scroll-mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Stat
                icon={<Users />}
                label="Patient records"
                value={patientTotal === null ? "—" : patientTotal.toLocaleString()}
                detail={patientCountError ? "Total temporarily unavailable" : "Recent records"}
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

            <div
              id="patient-lookup"
              className="mt-7 scroll-mt-6 grid gap-6 lg:grid-cols-[1.3fr_.7fr]"
            >
              <section className="flex h-[36rem] min-h-0 flex-col rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
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
                      className="w-56 rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent-strong"
                    />
                  </div>
                </div>
                <div
                  ref={patientListRef}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    if (element.scrollHeight - element.scrollTop - element.clientHeight < 100) {
                      void loadMorePatients();
                    }
                  }}
                  className="mt-5 min-h-0 flex-1 divide-y divide-black/10 overflow-y-auto overscroll-contain pr-1"
                >
                  {patients.length ? (
                    patients.map((patient) => (
                      <Link
                        href={`/patients/${patient.id}`}
                        key={patient.id}
                        className="flex items-center justify-between py-4 hover:bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-full bg-accent/15 font-semibold text-accent-strong">
                            {patient.full_name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{patient.full_name}</p><span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-strong">{getPatientAgeGroup(patient.dob)}</span></div>
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
                      {patientLoading
                        ? "Loading patient records…"
                        : patientError
                          ? `Patient data unavailable: ${patientError}`
                          : "No matching patient records"}
                    </p>
                  )}
                  {patients.length > 0 && patientLoading && (
                    <p className="py-4 text-center text-xs text-black/50">Loading more patients…</p>
                  )}
                  {patients.length > 0 && patientError && (
                    <p role="status" className="py-4 text-center text-xs text-red-700">Could not load more patients: {patientError}</p>
                  )}
                  {patients.length > 0 && !patientHasMore && (
                    <p className="py-4 text-center text-xs text-black/40">All matching patients are loaded.</p>
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
                  <Warehouse className="text-accent" />
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
                          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${item.stock_quantity <= item.reorder_threshold ? "bg-accent/20 text-accent-strong" : "bg-canvas text-black"}`}
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

            <section
              id="recent-visits"
              className="mt-7 scroll-mt-6 rounded-2xl border border-black/10 bg-canvas p-6 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Recent patient visits</h2>
                  <p className="mt-1 text-sm text-black/60">
                    Latest recorded visits at your facility.
                  </p>
                </div>
                <span className="rounded-full bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent-strong">
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
                        {new Date(visit.visit_date).toLocaleDateString(
                          "en-PH",
                          { dateStyle: "medium" },
                        )}
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

            <PublicHealthPanel
              analytics={analytics}
              analyticsError={analyticsError}
            />
            <MonthlyReportButton />
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
    <section id="facility-overview" className="mt-7 scroll-mt-6 rounded-2xl border border-accent/40 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent-strong">
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
                        className="w-full max-w-10 rounded-t-md bg-accent"
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
                          className="h-full rounded-full bg-accent"
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
          <div className="mt-6 rounded-xl border border-accent/40 bg-canvas p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Increased reports for review</h3>
                <p className="mt-1 text-xs text-black/60">
                  Conditions with at least 3 visits and a marked increase from
                  the prior period.
                </p>
              </div>
              <Activity className="shrink-0 text-accent" size={20} />
            </div>
            {analytics.increased_reports.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {analytics.increased_reports.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-accent-strong">
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
            <p className="mt-2 text-xs font-medium text-accent-strong">
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
        <span className="text-accent">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-black/40">{detail}</p>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown request error";
}
