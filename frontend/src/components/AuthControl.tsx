"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Mode = "Log In"

export default function AuthControl({
  inverse = false,
  showSignUp = true,
}: {
  inverse?: boolean;
  showSignUp?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("Log In");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const supabase = getSupabaseClient();
      void supabase.auth
        .getSession()
        .then(({ data }) => setUser(data.session?.user.email ?? ""));
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user.email ?? "");
        window.dispatchEvent(
          new CustomEvent("healthsync-auth-change", {
            detail: Boolean(session),
          }),
        );
      });
      return () => data.subscription.unsubscribe();
    } catch {
      setMessage(
        "Add the public Supabase URL and anon key to enable authentication.",
      );
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setOpen(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : mode === "Log In"
            ? "User not found or password is incorrect."
            : "Sign up failed. Please try again.",
       );
    } finally {
      setBusy(false);
    }
  }
  async function logOut() {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      setMessage("You have logged out.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign out failed.");
    }
  }
  function showAuth(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setOpen(true);
  }
  return (
    <>
      {user ? (
        <div className="flex items-center gap-3">
          <span
            className={`hidden max-w-40 truncate text-xs md:block ${inverse ? "text-white/80" : "text-black/60"}`}
          >
            {user}
          </span>
          <button
            onClick={logOut}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-blue hover:bg-canvas"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => showAuth("Log In")}
            className="inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue/90"
          >
            <LogIn size={16} /> Sign in
          </button>
          {showSignUp && (
            <button
              onClick={() => showAuth("Log In")}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${inverse ? "border-white/50 text-white hover:bg-white/10" : "border-blue/20 text-blue hover:bg-canvas"}`}
            >
              Sign up
            </button>
          )}
        </div>
      )}
      {message && !open && (
        <span role="status" className="sr-only">
          {message}
        </span>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-blue/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-blue">
                  HealthSync account
                </p>
                <h2
                  id="auth-title"
                  className="mt-1 text-2xl font-bold text-blue"
                >
                  {mode === "Log In" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="mt-2 text-sm text-black/60">
                  {mode === "Log In"
                    ? "Sign in with your facility account."
                    : "Sign up to create a Supabase account."}
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-blue hover:bg-canvas"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-blue">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-3 text-blue outline-none focus:border-blue"
                />
              </label>
              <label className="block text-sm font-medium text-blue">
                Password
                <input
                  required
                  type="password"
                  minLength={6}
                  autoComplete={
                    mode === "Log In" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-3 text-blue outline-none focus:border-blue"
                />
              </label>
              {message && (
                <p role="alert" className="text-sm text-black">
                  {message}
                </p>
              )}
              <button
                disabled={busy}
                className="w-full rounded-xl bg-blue px-4 py-3 font-semibold text-white hover:bg-blue/90 disabled:opacity-60"
              >
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
