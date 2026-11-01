import { getApiHeaders } from "@/lib/supabase";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is required");
  const authHeaders = await getApiHeaders();
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...authHeaders, ...init.headers } });
  if (!response.ok) throw new Error(`HealthSync API error (${response.status})`);
  return response.json() as Promise<T>;
}

export interface Patient { id: string; full_name: string; dob: string; gender: string; contact_number: string | null; barangay_id: string; created_at: string }
export interface InventoryItem { id: string; medicine_name: string; stock_quantity: number; reorder_threshold: number; facility_id: string; updated_at: string }
export interface VaccinationLog { id: string; patient_id: string; vaccine_name: string; dose_number: number; date_administered: string; next_due_date: string | null; facility_id: string }
export interface UpcomingVaccination extends VaccinationLog { patients: { full_name: string } | null }
