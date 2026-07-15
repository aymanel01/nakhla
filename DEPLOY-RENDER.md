# Deploy Nakhla on Render (free — no credit card)

Fly.io trial ended. **Render** is the new free host: no card required, deploys from GitHub.

## One-time setup (5 minutes)

1. Open https://render.com and sign up with **GitHub**
2. Click **New +** → **Blueprint**
3. Connect repo: `aymanel01/nakhla`
4. Render reads `render.yaml` automatically
5. When asked for **ADMIN_PASSWORD**, enter: `Nakhla2026!` (or your own)
6. Click **Apply** — first deploy takes ~5–10 minutes

Your app will be at: **`https://nakhla.onrender.com`** (or similar)

## Student logins

| Email | Password |
|-------|----------|
| ismaili@nakhla.com | 12345678 |
| bassma@nakhla.com | 12345678 |
| … (all students) | 12345678 |
| admin@app.com | (your ADMIN_PASSWORD) |

## Free tier notes

- App **sleeps after 15 min** idle — first visit may take ~1 minute to wake up
- **750 hours/month** free (enough for one app running 24/7)
- Data is restored from bundled `seed-data/` on each cold start (lessons, students, quiz)

## Update content later

On your PC:

```powershell
cd C:\Users\PC\Downloads\c
# make changes locally, then:
node scripts/prepare-seed-data.mjs
git add apps/api/seed-data
git commit -m "Update seed data"
git push origin main
```

Render auto-redeploys from GitHub.

## Local development (unchanged)

```powershell
pnpm --filter @teaching-app/api dev
pnpm --filter @teaching-app/web dev
```

Open http://localhost:5173
