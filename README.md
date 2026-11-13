# HealthSync
## Structure
```text
backend/   FastAPI API and integrations
  app/main.py
  app/database.py
  app/routers/   Patient, inventory, and media routes
  app/services/   Cloudinary client
  requirements.txt
  .env.example
frontend/   Next.js + TypeScript + Tailwind
  src/app/   Pages and layout
  src/lib/   Supabase/API helpers
  package.json
  .env.example
```

## Setup

### Supabase configuration

Create a Supabase project, then copy its Project URL and publishable key (or
legacy anon key) from the project's API settings. These public values are used
by the frontend and the API. Do not put a `service_role` or secret key in
frontend configuration.

Copy the example files and replace the placeholders:

```powershell
Copy-Item frontend\.env.example frontend\.env.local
Copy-Item backend\.env.example backend\.env
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`frontend\.env.local`, and set the matching `SUPABASE_URL` and
`SUPABASE_ANON_KEY` in `backend\.env`. Keep the API URL as shown for local
development. Restart the frontend after changing its environment file.

The Supabase database must also have the tables and row-level security policies
expected by the API (`patients`, `medical_records`, `vaccination_logs`,
`medicine_inventory`, and `diagnostic_images`). No database schema or
migrations are included in this repository. API access also requires users to
have a trusted `facility_id` value in Supabase `app_metadata`; do not set
authorization claims from client-side signup code.

### Run the API

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```


### Run the frontend

```powershell
cd frontend
npm install
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```



function DashboardPreview() {
  return (
    <div className="rounded-[2rem] border border-black/10 bg-white p-5 shadow-card md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-black/60">Dashboard preview</p>
          <h2 className="mt-1 text-xl font-bold">Today at a glance</h2>
        </div>
        <span className="rounded-full bg-canvas px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue">
          Sample data
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric
          icon={<Users size={17} />}
          label="Patient records"
          value="248"
          note="Sample count"
        />
        <Metric
          icon={<Activity size={17} />}
          label="Visits today"
          value="12"
          note="Sample count"
        />
        <Metric
          icon={<Warehouse size={17} />}
          label="Medicine types"
          value="18"
          note="In facility"
        />
        <Metric
          icon={<ClipboardPlus size={17} />}
          label="Patients seen"
          value="96"
          note="Last 30 days"
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-canvas p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Available medicine</h3>
              <p className="mt-1 text-[11px] text-black/60">
                Current stock count
              </p>
            </div>
            <Pill className="text-blue" size={18} />
          </div>
          <StockRow name="Amlodipine 5 mg" count="8 in stock" />
          <StockRow name="Paracetamol 500 mg" count="42 in stock" />
        </div>
        <div className="rounded-2xl border border-black/10 bg-canvas p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Recent patient visits</h3>
              <p className="mt-1 text-[11px] text-black/60">
                Latest facility activity
              </p>
            </div>
            <Bell className="text-blue" size={18} />
          </div>
          <VisitRow
            name="Sample Patient A"
            detail="Respiratory symptoms · Today"
          />
          <VisitRow
            name="Sample Patient B"
            detail="Follow-up visit · Yesterday"
          />
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-blue p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] text-white/70">
              PUBLIC HEALTH MONITORING
            </p>
            <h3 className="mt-1 font-semibold">Visit trends for review</h3>
          </div>
          <span className="rounded-full bg-canvas/10 px-3 py-1 text-xs">
            30 day view
          </span>
        </div>
        <div
          className="mt-3 flex items-end gap-1.5"
          aria-label="Illustrative weekly visit activity"
        >
          <i className="h-5 flex-1 rounded-t bg-canvas/50" />
          <i className="h-8 flex-1 rounded-t bg-canvas/60" />
          <i className="h-6 flex-1 rounded-t bg-canvas/50" />
          <i className="h-11 flex-1 rounded-t bg-canvas/80" />
          <i className="h-9 flex-1 rounded-t bg-canvas/70" />
          <i className="h-14 flex-1 rounded-t bg-canvas" />
        </div>
        <p className="mt-3 text-[10px] leading-4 text-white/70">
          Illustrative only. Trends are reviewed by health staff and do not
          confirm an outbreak.
        </p>
      </div>
    </div>
  );
}