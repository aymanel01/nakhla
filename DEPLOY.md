# Deploy Nakhla with GitHub + Fly.io (free)

This project uses **GitHub Actions** to deploy automatically when you push to `main`.

## What you get

- Public HTTPS URL like `https://nakhla.fly.dev`
- API + web app + SQLite + uploads on one server
- Auto-deploy on every push to GitHub

## One-time setup

### 1. Install Fly CLI

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### 2. Create a Fly.io account and app

```powershell
cd C:\Users\PC\Downloads\c
fly auth login
fly apps create nakhla
fly volumes create nakhla_data --region cdg --size 1
```

If the app name `nakhla` is taken, change `app = "nakhla"` in `fly.toml` to a unique name.

### 3. Set production secrets

```powershell
fly secrets set JWT_SECRET="your-long-random-secret-here"
fly secrets set ADMIN_PASSWORD="your-strong-admin-password"
```

Optional:

```powershell
fly secrets set ADMIN_EMAIL="admin@app.com"
```

### 4. Connect GitHub to auto-deploy

1. Open your repo: https://github.com/aymanel01/nakhla
2. Go to **Settings → Secrets and variables → Actions**
3. Add a new secret:
   - Name: `FLY_API_TOKEN`
   - Value: run `fly tokens create deploy -x 999999h` and paste the token

### 5. First deploy

Either push to `main`:

```powershell
git add .
git commit -m "Add GitHub deploy workflow"
git push origin main
```

Or deploy manually once:

```powershell
fly deploy
```

## After deploy

- App URL: `fly open`
- Admin login: `admin@app.com` + the password you set in `ADMIN_PASSWORD`
- SSH into the server: `fly ssh console`

## Seed quiz and lesson content (optional)

After the first deploy, seed content into the production database:

```powershell
fly ssh console
cd /app/apps/api
node seed-map-quiz.mjs
node seed-writing-lesson.mjs
```

## Local development (unchanged)

```powershell
pnpm --filter @teaching-app/api dev
pnpm --filter @teaching-app/web dev
```

Open http://localhost:5173

## Notes

- **GitHub Pages** cannot run this app (needs Node API + database).
- **ngrok** is fine for quick tests from your PC, not for production.
- Fly.io free tier may sleep the app when idle; first visit can take a few seconds to wake up.
- Change the default admin password before sharing the public URL.
