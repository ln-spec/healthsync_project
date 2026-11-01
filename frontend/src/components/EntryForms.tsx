"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, type Patient } from "@/lib/api";

type Kind = "patient" | "visit" | "vaccine" | "inventory";
const inputClass = "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue";
const labelClass = "block text-sm font-medium text-ink";

export default function EntryForms({ onSaved }: { onSaved: () => void }) {
  const [kind, setKind] = useState<Kind>("patient");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const load = () => { void api<Patient[]>("/patients?limit=100").then(setPatients).catch(() => setPatients([])); };
    load(); window.addEventListener("healthsync-auth-change", load); return () => window.removeEventListener("healthsync-auth-change", load);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? "");
    let path = ""; let payload: Record<string, string | number | null> = {};
    if (kind === "patient") {
      path = "/patients"; payload = { full_name: value("full_name").trim(), dob: value("dob"), gender: value("gender"), contact_number: value("contact_number").trim() || null };
    } else if (kind === "visit") {
      path = `/patients/${value("patient_id")}/medical-records`; payload = { visit_date: new Date(`${value("visit_date")}T12:00:00`).toISOString(), diagnosis: value("diagnosis").trim() || null, treatment: value("treatment").trim() || null, notes: value("notes").trim() || null };
    } else if (kind === "vaccine") {
      path = `/patients/${value("patient_id")}/vaccinations`; payload = { vaccine_name: value("vaccine_name").trim(), dose_number: Number(value("dose_number")), date_administered: value("date_administered"), next_due_date: value("next_due_date") || null };
    } else {
      path = "/inventory"; payload = { medicine_name: value("medicine_name").trim(), stock_quantity: Number(value("stock_quantity")), reorder_threshold: Number(value("reorder_threshold")) };
    }
    try {
      await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage("Entry saved successfully."); formElement.reset(); onSaved();
      if (kind === "patient") void api<Patient[]>("/patients?limit=100").then(setPatients).catch(() => undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this entry. Sign in and check facility access."); }
    finally { setBusy(false); }
  }
  const patientSelect = <label className={labelClass}>Patient<select name="patient_id" required className={inputClass}><option value="">Select a patient</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>{!patients.length && <span className="mt-1 block text-xs text-black/60">Add a patient first or sign in to load your directory.</span>}</label>;
  return <><div className="mt-6 flex justify-end"><button onClick={() => { setMessage(""); setOpen(true); }} className="rounded-xl bg-blue px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-blue/90 focus:outline-none focus:ring-4 focus:ring-blue/20">Input</button></div>
    {open && <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-blue/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="entry-title" className="my-4 w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-card"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="entry-title" className="text-lg font-bold text-blue">Input table values</h2><p className="mt-1 text-sm text-black/60">Enter a patient, visit, vaccination, or medicine inventory item.</p></div><button aria-label="Close input window" onClick={() => setOpen(false)} className="rounded-full p-2 text-blue hover:bg-canvas"><X size={18}/></button></div><select aria-label="Entry type" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setMessage(""); }} className="mt-5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-blue focus:border-blue"><option value="patient">Patient</option><option value="visit">Medical visit</option><option value="vaccine">Vaccination</option><option value="inventory">Medicine inventory</option></select>
    <form key={kind} onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      {kind === "patient" && <><label className={labelClass}>Full name<input name="full_name" required maxLength={200} className={inputClass}/></label><label className={labelClass}>Date of birth<input name="dob" required type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass}/></label><label className={labelClass}>Gender<select name="gender" required className={inputClass}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="unknown">Unknown</option></select></label><label className={labelClass}>Contact number <span className="font-normal text-black/60">(optional)</span><input name="contact_number" type="tel" maxLength={40} className={inputClass}/></label></>}
      {kind === "visit" && <>{patientSelect}<label className={labelClass}>Visit date<input name="visit_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass}/></label><label className={labelClass}>Diagnosis<input name="diagnosis" maxLength={2000} className={inputClass}/></label><label className={labelClass}>Treatment<input name="treatment" maxLength={4000} className={inputClass}/></label><label className={`${labelClass} sm:col-span-2`}>Notes<textarea name="notes" rows={3} maxLength={8000} className={inputClass}/></label></>}
      {kind === "vaccine" && <>{patientSelect}<label className={labelClass}>Vaccine name<input name="vaccine_name" required maxLength={200} className={inputClass}/></label><label className={labelClass}>Dose number<input name="dose_number" required type="number" min="1" step="1" className={inputClass}/></label><label className={labelClass}>Date administered<input name="date_administered" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass}/></label><label className={labelClass}>Next due date <span className="font-normal text-black/60">(optional)</span><input name="next_due_date" type="date" className={inputClass}/></label></>}
      {kind === "inventory" && <><label className={labelClass}>Medicine name<input name="medicine_name" required maxLength={200} className={inputClass}/></label><label className={labelClass}>Quantity in stock<input name="stock_quantity" required type="number" min="0" step="1" className={inputClass}/></label><label className={labelClass}>Reorder threshold<input name="reorder_threshold" required type="number" min="0" step="1" className={inputClass}/></label></>}
      <div className="flex items-center gap-3 sm:col-span-2"><button disabled={busy || ((kind === "visit" || kind === "vaccine") && patients.length === 0)} className="rounded-xl bg-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue/90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Save entry"}</button>{message && <p role="status" className="text-sm text-black/70">{message}</p>}</div>
    </form>
    </section></div>}
  </>;
}
