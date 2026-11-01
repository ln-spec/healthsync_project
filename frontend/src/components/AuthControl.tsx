"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function AuthControl({ inverse = false }: { inverse?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const supabase = getSupabaseClient();
      void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user.email ?? ""));
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user.email ?? "");
        window.dispatchEvent(new CustomEvent("healthsync-auth-change", { detail: Boolean(session) }));
      });
      return () => data.subscription.unsubscribe();
    } catch { setMessage("Add the public Supabase URL and anon key to enable authentication."); }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const supabase = getSupabaseClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) { setOpen(false); setPassword(""); }
        setMessage(data.session ? "Your account was created and you are signed in." : "Account created. Check your email to confirm it, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (/invalid login credentials|user not found|invalid credentials/i.test(error.message)) throw new Error("User not found or password is incorrect.");
          throw error;
        }
        setOpen(false); setPassword(""); setMessage("Signed in successfully.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : mode === "signin" ? "User not found or password is incorrect." : "Sign up failed."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { const { error } = await getSupabaseClient().auth.signOut(); if (error) throw error; setMessage("You have signed out."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Sign out failed."); }
  }
  function showAuth(nextMode: Mode) { setMode(nextMode); setMessage(""); setOpen(true); }
  return <>
    {user ? <div className="flex items-center gap-3"><span className={`hidden max-w-40 truncate text-xs md:block ${inverse ? "text-white/80" : "text-black/60"}`}>{user}</span><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-blue hover:bg-canvas"><LogOut size={16}/> Sign out</button></div> : <div className="flex items-center gap-2"><button onClick={() => showAuth("signin")} className="inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue/90"><LogIn size={16}/> Sign in</button><button onClick={() => showAuth("signup")} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${inverse ? "border-white/50 text-white hover:bg-white/10" : "border-blue/20 text-blue hover:bg-canvas"}`}>Sign up</button></div>}
    {message && !open && <span role="status" className="sr-only">{message}</span>}
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-blue/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-md rounded-3xl bg-white p-7 shadow-card"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-blue">HealthSync account</p><h2 id="auth-title" className="mt-1 text-2xl font-bold text-blue">{mode === "signin" ? "Welcome back" : "Create your account"}</h2><p className="mt-2 text-sm text-black/60">{mode === "signin" ? "Sign in with your facility account." : "Sign up to create a Supabase account."}</p></div><button aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-2 text-blue hover:bg-canvas"><X size={18}/></button></div><div className="mt-5 grid grid-cols-2 rounded-xl bg-canvas p-1"><button type="button" onClick={() => { setMode("signin"); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-blue text-white" : "text-blue"}`}>Sign in</button><button type="button" onClick={() => { setMode("signup"); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-blue text-white" : "text-blue"}`}>Sign up</button></div><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-medium text-blue">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-3 text-blue outline-none focus:border-blue"/></label><label className="block text-sm font-medium text-blue">Password<input required type="password" minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-3 text-blue outline-none focus:border-blue"/>{mode === "signup" && <span className="mt-1 block text-xs text-black/60">Use at least 6 characters.</span>}</label>{message && <p role="alert" className="text-sm text-black">{message}</p>}<button disabled={busy} className="w-full rounded-xl bg-blue px-4 py-3 font-semibold text-white hover:bg-blue/90 disabled:opacity-60">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button></form>{mode === "signup" && <p className="mt-4 text-xs text-black/60">Email confirmation may be required. New accounts also need a facility assignment to access records.</p>}</section></div>}
  </>;
}
