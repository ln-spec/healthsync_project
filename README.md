# HealthSync
## Structure
```text
backend/   FastAPI API and integrations
  app/main.py
  app/database.py
  app/routers/   Patient, inventory, and media routes
  app/services/   Cloudinary client
  requirements.txt
  .env
frontend/   Next.js + TypeScript + Tailwind
  src/app/   Pages and layout
  src/lib/   Supabase/API helpers
  package.json
  .env.example
```

## Setup
```bash
   cd backend
   python -m venv .venv or & "C:\Program Files\Python313\python.exe" -m venv .venv or py -3.12 -m venv .venv
   .venv\\Scripts\\Activate.ps1 (Windows)
   pip install -r requirements.txt
   uvicorn app.main:app --reload
```
```bash
   cd frontend
   npm install
   npm run dev
   ```
