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
   py -3.13 -m venv .venv
   .venv\\Scripts\\Activate.ps1 (Windows)
   python -m pip install --upgrade pip setuptools wheel
   python -m pip install -r requirements.txt
   uvicorn app.main:app --reload
```
```bash
   cd frontend
   npm install
   npm run dev
   ```
