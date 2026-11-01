"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, FileImage, Syringe, Upload } from "lucide-react";
import { api, type Patient } from "@/lib/api";
import { getApiHeaders } from "@/lib/supabase";
import AuthControl from "@/components/AuthControl";

interface MedicalRecord { id: string; visit_date: string; diagnosis: string | null; treatment: string | null; notes: string | null; originating_facility_id: string }
interface Vaccination { id: string; vaccine_name: string; dose_number: number; date_administered: string; next_due_date: string | null }
interface DiagnosticImage { id: string; image_url: string; uploaded_at: string }

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [vaccines, setVaccines] = useState<Vaccination[]>([]);
  const [savedImages, setSavedImages] = useState<DiagnosticImage[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const load = () => { Promise.all([api<Patient>(`/patients/${params.id}`), api<MedicalRecord[]>(`/patients/${params.id}/medical-records`), api<Vaccination[]>(`/patients/${params.id}/vaccinations`), api<DiagnosticImage[]>(`/patients/${params.id}/diagnostic-images`)]).then(([p, r, v, d]) => { setPatient(p); setRecords(r); setVaccines(v); setSavedImages(d); setMessage(""); }).catch(() => { setPatient(null); setRecords([]); setVaccines([]); setSavedImages([]); setMessage("Patient details are unavailable. Check your facility access."); }); };
    load(); window.addEventListener("healthsync-auth-change", load); return () => window.removeEventListener("healthsync-auth-change", load);
  }, [params.id]);
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setMessage("Uploading diagnostic image…");
    try { const headers = await getApiHeaders(); const body = new FormData(); body.append("file", file); body.append("patient_id", params.id); const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/media/diagnostic`, { method: "POST", headers, body }); if (!response.ok) throw new Error(); const data = await response.json() as { url: string }; setImages((current) => [data.url, ...current]); setMessage("Image uploaded securely."); }
    catch { setMessage("Image upload failed. Confirm sign-in and Cloudinary configuration."); }
    finally { event.target.value = ""; }
  }
  return <main className="min-h-screen bg-canvas"><header className="border-b border-blue/20 bg-blue text-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-white"><ArrowLeft size={17}/> Back to dashboard</Link><div className="flex items-center gap-4"><span className="hidden items-center gap-2 font-bold sm:flex"><Activity className="text-canvas"/> HealthSync</span><AuthControl inverse/></div></div></header><div className="mx-auto max-w-6xl px-6 py-8">{patient ? <><section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card"><div className="flex flex-wrap items-center gap-4"><span className="grid size-16 place-items-center rounded-2xl bg-mint text-xl font-bold text-blue">{patient.full_name.split(" ").map((s)=>s[0]).slice(0,2).join("").toUpperCase()}</span><div><p className="text-sm text-blue">Patient profile</p><h1 className="mt-1 text-2xl font-bold">{patient.full_name}</h1><p className="mt-1 text-sm text-black/60">Born {patient.dob} · {patient.gender} · {patient.contact_number || "No contact listed"}</p></div></div></section><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.65fr]"><section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Medical history</h2><p className="mt-1 text-sm text-black/60">Visit timeline, subject to facility access.</p></div><CalendarDays className="text-blue"/></div><div className="mt-6 space-y-5">{records.length ? records.map((record)=><article key={record.id} className="relative border-l-2 border-teal/20 pl-5"><span className="absolute -left-[7px] top-1 size-3 rounded-full bg-teal"/><p className="text-xs font-semibold text-blue">{new Date(record.visit_date).toLocaleDateString()}</p><h3 className="mt-1 font-semibold">{record.diagnosis || "Visit record"}</h3>{record.treatment && <p className="mt-1 text-sm text-black/70">Treatment: {record.treatment}</p>}{record.notes && <p className="mt-2 text-sm leading-6 text-black/60">{record.notes}</p>}</article>) : <p className="rounded-xl bg-canvas p-4 text-sm text-black/60">{message || "No accessible visits loaded."}</p>}</div></section><div className="space-y-6"><section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Vaccinations</h2><p className="mt-1 text-sm text-black/60">Recorded doses and next due dates.</p></div><Syringe className="text-blue"/></div><div className="mt-4 space-y-3">{vaccines.length ? vaccines.map((v)=><div key={v.id} className="rounded-xl bg-canvas p-4"><p className="font-semibold">{v.vaccine_name} · dose {v.dose_number}</p><p className="mt-1 text-xs text-black/60">Given {v.date_administered}{v.next_due_date ? ` · Due ${v.next_due_date}` : ""}</p></div>) : <p className="text-sm text-black/60">No vaccination entries loaded.</p>}</div></section><section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Diagnostic images</h2><p className="mt-1 text-sm text-black/60">Attach a report image.</p></div><FileImage className="text-blue"/></div><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-teal/40 bg-mint/40 px-4 py-4 text-sm font-semibold text-blue hover:bg-mint"><Upload size={17}/> Choose image<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadImage}/></label>{message && <p role="status" className="mt-3 text-xs text-black/60">{message}</p>}<div className="mt-4 grid grid-cols-2 gap-2">{[...images, ...savedImages.map((image) => image.image_url)].map((url)=><a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate rounded-lg bg-canvas p-3 text-xs text-blue">View uploaded image</a>)}</div></section></div></div></> : <div className="rounded-2xl bg-canvas p-8 text-sm text-black/60">{message || "Loading patient profile…"}</div>}</div></main>;
}

