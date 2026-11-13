import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowRight,
  ClipboardPlus,
  ShieldCheck,
  Users,
} from "lucide-react";
import AuthControl from "@/components/AuthControl";

export default function HomePage() {  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3 text-xl font-bold text-blue">
          <span className="grid size-10 place-items-center rounded-2xl bg-blue text-white shadow-card">
            <Activity size={20} />
          </span>
          HealthSync
        </Link>
        <div className="flex items-center gap-3">
          <AuthControl showSignUp={false} />
          <Link
            href="/dashboard"
            className="rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-blue/90"
          >
            Open dashboard <ArrowRight className="ml-1 inline" size={16} />
          </Link>
        </div>
      </nav>
      <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-10 md:grid-cols-[.9fr_1.1fr] md:gap-16 md:pb-28 md:pt-14">
        <div className="relative z-10 py-4 md:py-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue/10 bg-blue/[0.06] px-4 py-2 text-sm font-semibold text-blue">
            <ShieldCheck size={16} /> Care that brings us together
          </div>
          <h1 className="max-w-2xl text-5xl font-bold leading-[1.06] tracking-tight text-ink md:text-7xl">
            Community care,
            <br />
            <span className="text-blue">connected.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 md:text-xl">
            A secure workspace for barangay health teams to keep patient
            histories, visit activity, and essential medicines in sync.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-blue px-6 py-3.5 font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-blue/90"
            >
              Go to dashboard <ArrowRight className="ml-2 inline" size={17} />
            </Link>
            <a
              href="#features"
              className="rounded-full border border-slate-200 px-6 py-3.5 font-semibold text-slate-700 transition hover:border-blue/30 hover:bg-blue/[0.04]"
            >
              Explore platform
            </a>
          </div>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-500">
            <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck size={18} />
            </span>
            Thoughtfully designed for community health teams
          </div>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-sky-100 bg-[#c9e8f5] shadow-[0_28px_80px_rgba(15,71,112,0.16)] md:min-h-[580px]">
          <Image
            src="/images/PIC.jpg"
            alt="Illustration celebrating community healthcare workers"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
          />
          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur">
            <span className="size-2 rounded-full bg-emerald-500" />
            Healthier communities, together
          </div>
        </div>
      </section>
      <section id="features" className="bg-white py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 max-w-2xl md:mb-12">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue">
              Made for your team
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              The right care starts with being in sync.
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Keep essential health information clear, connected, and easy to
              follow up.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Feature
              title="One patient story"
              copy="Find visit notes and treatment history in a clear, useful timeline."
              icon={<ClipboardPlus />}
            />
            <Feature
              title="Facility visit feed"
              copy="See recent patient visits and follow activity across your facility."
              icon={<Activity />}
            />
            <Feature
              title="Public health signals"
              copy="Review recorded diagnosis trends and changes that may need follow-up."
              icon={<Users />}
            />
          </div>
        </div>
      </section>
      <footer className="border-t border-slate-100 bg-white px-6 py-8 text-center text-sm text-slate-500">
        <span className="font-semibold text-blue">HealthSync</span> · Community care, connected
      </footer>
    </main>
  );
}
function Feature({
  title,
  copy,
  icon,
}: {
  title: string;
  copy: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="group rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue/20 hover:shadow-xl">
      <span className="grid size-12 place-items-center rounded-2xl bg-blue/[0.07] text-blue transition group-hover:bg-blue group-hover:text-white">
        {icon}
      </span>
      <h3 className="mt-5 font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </article>
  );
}
