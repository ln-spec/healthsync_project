"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  FileImage,
  Pencil,
  Save,
  Syringe,
  Upload,
  X,
} from "lucide-react";
import { api, type Patient } from "@/lib/api";
import { getApiHeaders } from "@/lib/supabase";
import AuthControl from "@/components/AuthControl";
import { getPatientAgeGroup } from "@/lib/patientAgeGroup";

interface MedicalRecord {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
  originating_facility_id: string;
}
interface Vaccination {
  id: string;
  vaccine_name: string;
  dose_number: number;
  date_administered: string;
  next_due_date: string | null;
}
interface DiagnosticImage {
  id: string;
  image_url: string;
  uploaded_at: string;
}

function mergeImages(current: DiagnosticImage[], incoming: DiagnosticImage[]) {
  const byId = new Map(current.map((image) => [image.id, image]));
  for (const image of incoming) byId.set(image.id, image);
  return [...byId.values()].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed.";
}

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [vaccines, setVaccines] = useState<Vaccination[]>([]);
  const [savedImages, setSavedImages] = useState<DiagnosticImage[]>([]);
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesMessage, setNotesMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [vaccinationsError, setVaccinationsError] = useState("");
  const [imagesError, setImagesError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const load = () => {
      Promise.allSettled([
        api<Patient>(`/patients/${params.id}`),
        api<MedicalRecord[]>(`/patients/${params.id}/medical-records`),
        api<Vaccination[]>(`/patients/${params.id}/vaccinations`),
        api<DiagnosticImage[]>(`/patients/${params.id}/diagnostic-images`),
      ])
        .then(
          ([patientResult, recordsResult, vaccinationsResult, imagesResult]) => {
          if (patientResult.status === "rejected") {
            setPatient(null);
              setRecords([]);
              setVaccines([]);
              setSavedImages([]);
              setPageError(
                `Patient details are unavailable: ${errorMessage(patientResult.reason)}`,
              );
              return;
            }

            setPageError("");
            setPatient(patientResult.value);
            setNotesDraft(patientResult.value.patient_notes ?? "");
            if (recordsResult.status === "fulfilled") {
              setRecords(recordsResult.value);
              setRecordsError("");
            } else {
              setRecords([]);
              setRecordsError(errorMessage(recordsResult.reason));
            }
            if (vaccinationsResult.status === "fulfilled") {
              setVaccines(vaccinationsResult.value);
              setVaccinationsError("");
            } else {
              setVaccines([]);
              setVaccinationsError(errorMessage(vaccinationsResult.reason));
            }
            if (imagesResult.status === "fulfilled") {
              setSavedImages((current) => mergeImages(current, imagesResult.value));
              setImagesError("");
            } else {
              setSavedImages([]);
              setImagesError(errorMessage(imagesResult.reason));
            }
          },
        );
    };
    load();
    window.addEventListener("healthsync-auth-change", load);
    return () => window.removeEventListener("healthsync-auth-change", load);
  }, [params.id]);
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("Uploading diagnostic image…");
    try {
      const headers = await getApiHeaders();
      const body = new FormData();
      body.append("file", file);
      body.append("patient_id", params.id);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/media/diagnostic`,
        { method: "POST", headers, body },
      );
      if (!response.ok) {
        let detail = "";
        try { detail = ((await response.json()) as { detail?: string }).detail ?? ""; } catch { /* Keep the generic message. */ }
        throw new Error(detail || `Upload failed (${response.status}).`);
      }
      const data = (await response.json()) as { id: string; url: string };
      setSavedImages((current) => mergeImages(current, [{ id: data.id, image_url: data.url, uploaded_at: new Date().toISOString() }]));
      setImagesError("");
      setMessage("Image uploaded securely.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed. Confirm sign-in and Cloudinary configuration.");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }
  async function openUploads() {
    setUploadsOpen(true);
    setImagesError("");
    try {
      const latest = await api<DiagnosticImage[]>(`/patients/${params.id}/diagnostic-images`);
      setSavedImages((current) => mergeImages(current, latest));
    } catch (error) {
      setImagesError(errorMessage(error));
    }
  }
  async function savePatientNotes() {
    setNotesBusy(true);
    setNotesMessage("");
    try {
      const updated = await api<Patient>(`/patients/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_notes: notesDraft.trim() || null }),
      });
      setPatient(updated);
      setNotesDraft(updated.patient_notes ?? "");
      setNotesEditing(false);
      setNotesMessage("Patient notes saved.");
    } catch (error) {
      setNotesMessage(errorMessage(error));
    } finally {
      setNotesBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-blue/20 bg-blue text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-white"
          >
            <ArrowLeft size={17} /> Back to dashboard
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 font-bold sm:flex">
              <Activity className="text-canvas" /> HealthSync
            </span>
            <AuthControl inverse />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {patient ? (
          <>
            <section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid size-16 place-items-center rounded-2xl bg-mint text-xl font-bold text-blue">
                  {patient.full_name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <p className="text-sm text-blue">Patient profile</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{patient.full_name}</h1><span className="rounded-full bg-blue/10 px-2.5 py-1 text-xs font-semibold text-blue">{getPatientAgeGroup(patient.dob)}</span></div>
                  <p className="mt-1 text-sm text-black/60">
                    Born {patient.dob} · {patient.gender} ·{" "}
                    {patient.contact_number || "No contact listed"}
                  </p>
                </div>
              </div>
              <div className="mt-6 border-t border-black/10 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-semibold">Patient notes</h2><p className="mt-1 text-xs text-black/60">Conditions and other important details for this patient.</p></div>
                  {!notesEditing && <button type="button" onClick={() => { setNotesDraft(patient.patient_notes ?? ""); setNotesMessage(""); setNotesEditing(true); }} className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-blue hover:bg-canvas"><Pencil size={15}/>{patient.patient_notes ? "Edit notes" : "Add notes"}</button>}
                </div>
                {notesEditing ? <div className="mt-3"><textarea aria-label="Patient notes" value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} rows={4} maxLength={8000} placeholder="Conditions, allergies, or other important details" className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue"/><div className="mt-2 flex items-center gap-2"><button type="button" disabled={notesBusy} onClick={savePatientNotes} className="inline-flex items-center gap-2 rounded-lg bg-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue/90 disabled:opacity-60"><Save size={15}/>{notesBusy ? "Saving…" : "Save notes"}</button><button type="button" disabled={notesBusy} onClick={() => { setNotesDraft(patient.patient_notes ?? ""); setNotesEditing(false); setNotesMessage(""); }} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70 hover:bg-canvas">Cancel</button></div></div> : <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6 text-black/70">{patient.patient_notes || "No patient notes have been added."}</p>}
                {notesMessage && <p role="status" className="mt-2 text-xs text-black/60">{notesMessage}</p>}
              </div>
            </section>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.65fr]">
              <section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Medical history</h2>
                    <p className="mt-1 text-sm text-black/60">
                      Visit timeline, subject to facility access.
                    </p>
                  </div>
                  <CalendarDays className="text-blue" />
                </div>
                <div className="mt-6 space-y-5">
                  {records.length ? (
                    records.map((record) => (
                      <article
                        key={record.id}
                        className="relative border-l-2 border-teal/20 pl-5"
                      >
                        <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-teal" />
                        <p className="text-xs font-semibold text-blue">
                          {new Date(record.visit_date).toLocaleDateString()}
                        </p>
                        <h3 className="mt-1 font-semibold">
                          {record.diagnosis || "Visit record"}
                        </h3>
                        {record.treatment && (
                          <p className="mt-1 text-sm text-black/70">
                            Treatment: {record.treatment}
                          </p>
                        )}
                        {record.notes && (
                          <p className="mt-2 text-sm leading-6 text-black/60">
                            {record.notes}
                          </p>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="rounded-xl bg-canvas p-4 text-sm text-black/60">
                      {recordsError || "No accessible visits loaded."}
                    </p>
                  )}
                </div>
              </section>
              <div className="space-y-6">
                <section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Vaccinations</h2>
                      <p className="mt-1 text-sm text-black/60">
                        Recorded doses and next due dates.
                      </p>
                    </div>
                    <Syringe className="text-blue" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {vaccines.length ? (
                      vaccines.map((v) => (
                        <div key={v.id} className="rounded-xl bg-canvas p-4">
                          <p className="font-semibold">
                            {v.vaccine_name} · dose {v.dose_number}
                          </p>
                          <p className="mt-1 text-xs text-black/60">
                            Given {v.date_administered}
                            {v.next_due_date ? ` · Due ${v.next_due_date}` : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-black/60">
                        {vaccinationsError || "No vaccination entries loaded."}
                      </p>
                    )}
                  </div>
                </section>
                <section className="rounded-2xl border border-black/10 bg-canvas p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Diagnostic images</h2>
                      <p className="mt-1 text-sm text-black/60">
                        Attach a report image.
                      </p>
                    </div>
                    <FileImage className="text-blue" />
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-teal/40 bg-mint/40 px-4 py-4 text-sm font-semibold text-blue hover:bg-mint">
                    <Upload size={17} /> {uploading ? "Uploading image…" : "Choose image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={uploading}
                      onChange={uploadImage}
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3"><p role="status" className="min-w-0 truncate text-xs text-black/60">{message || imagesError}</p><button type="button" onClick={openUploads} className="shrink-0 rounded-lg border border-blue/20 bg-white px-3 py-2 text-sm font-semibold text-blue hover:bg-blue/5">Uploads ({savedImages.length})</button></div>
                </section>
              </div>
            </div>
            {uploadsOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setUploadsOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="uploads-title" className="my-6 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-card sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 id="uploads-title" className="text-xl font-bold text-blue">Uploaded diagnostic images</h2><p className="mt-1 text-sm text-black/60">{savedImages.length} image{savedImages.length === 1 ? "" : "s"} for {patient.full_name}</p></div><button type="button" aria-label="Close uploads" onClick={() => setUploadsOpen(false)} className="rounded-full p-2 text-blue hover:bg-canvas"><X size={18}/></button></div>{imagesError && <p role="status" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{imagesError}</p>}{savedImages.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{savedImages.map((image) => <a key={image.id} href={image.image_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-black/10 bg-canvas focus:outline-none focus:ring-2 focus:ring-blue"><img src={image.image_url} alt={`Diagnostic upload from ${new Date(image.uploaded_at).toLocaleDateString()}`} className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"/><p className="truncate px-3 py-2 text-xs text-black/60">Uploaded {new Date(image.uploaded_at).toLocaleDateString()}</p></a>)}</div> : !imagesError ? <p className="mt-5 rounded-xl bg-canvas p-8 text-center text-sm text-black/60">No images have been uploaded for this patient.</p> : null}</section></div>}
          </>
        ) : (
          <div className="rounded-2xl bg-canvas p-8 text-sm text-black/60">
            {pageError || "Loading patient profile…"}
          </div>
        )}
      </div>
    </main>
  );
}
