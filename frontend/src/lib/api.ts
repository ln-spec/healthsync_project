import { getApiHeaders } from "@/lib/supabase";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is required");
  const authHeaders = await getApiHeaders();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...authHeaders, ...init.headers },
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as {
        detail?: string;
        message?: string;
      };
      detail = body.detail || body.message || "";
    } catch {
      /* Keep the status when the API response has no JSON body. */
    }
    throw new Error(
      detail || `HealthSync API error (${response.status}) for ${path}`,
    );
  }
  return response.json() as Promise<T>;
}
async function readError(response: Response, path: string): Promise<string> {
  try {
    const body = await response.json() as { detail?: string | Array<{ msg?: string }>; message?: string };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
    if (body.message) return body.message;
  } catch { /* Keep the status when the API response has no JSON body. */ }
  return `HealthSync API error (${response.status}) for ${path}`;
}

/** Authenticated file download: fetches with the bearer token, then saves the blob via a temporary link. Returns the saved filename. */
export async function downloadFile(path: string, fallbackName: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is required");
  const response = await fetch(`${baseUrl}${path}`, { headers: await getApiHeaders() });
  if (!response.ok) throw new Error(await readError(response, path));
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
export interface Patient {
  id: string;
  full_name: string;
  dob: string;
  gender: string;
  contact_number: string | null;
  patient_notes: string | null;
  barangay_id: string;
  created_at: string;
}
export interface InventoryItem {
  id: string;
  medicine_name: string;
  stock_quantity: number;
  reorder_threshold: number;
  facility_id: string;
  updated_at: string;
}
export interface VaccinationLog {
  id: string;
  patient_id: string;
  vaccine_name: string;
  dose_number: number;
  date_administered: string;
  next_due_date: string | null;
  facility_id: string;
}
export interface UpcomingVaccination extends VaccinationLog {
  patients: { full_name: string } | null;
}
export interface PublicHealthAnalytics {
  period_days: number;
  current_visits: number;
  visits_today: number;
  previous_visits: number;
  unique_patients: number;
  previous_unique_patients: number;
  diagnosis_categories: number;
  diagnoses: Array<{
    name: string;
    count: number;
    previous_count: number;
    change_percent: number | null;
  }>;
  increased_reports: Array<{
    name: string;
    count: number;
    previous_count: number;
    change_percent: number | null;
  }>;
  weekly_visits: Array<{ week_start: string; count: number }>;
  recent_visits: Array<{
    id: string;
    patient_id: string;
    patient_name: string;
    visit_date: string;
    diagnosis: string;
  }>;
  record_limit_reached: boolean;
}
export interface TodayVisitCount {
  date: string;
  count: number;
}

export interface MunicipalDashboard {
  municipality_id: string;
  municipality_name: string;
  facility_count: number;
  generated_at: string;
  patient_counts: {
    total: number;
    by_age_group: Array<{ type: string; count: number }>;
    by_barangay: Array<{ facility_id: string; barangay_name: string; count: number }>;
  };
  public_health: {
    period_days: number;
    current_visits: number;
    previous_visits: number;
    unique_patients: number;
    previous_unique_patients: number;
    diagnosis_categories: number;
    diagnoses: Array<{ name: string; count: number; previous_count: number; change_percent: number | null }>;
    increased_reports: Array<{ name: string; count: number; previous_count: number; change_percent: number | null }>;
    weekly_visits: Array<{ week_start: string; count: number }>;
  };
  inventory: Array<{
    facility_id: string;
    barangay_name: string;
    medicine_name: string;
    stock_quantity: number;
    reorder_threshold: number;
    low_stock: boolean;
  }>;
  low_stock_count: number;
}

export interface FacilityInfo {
  facility_id: string;
  barangay_name: string;
}
