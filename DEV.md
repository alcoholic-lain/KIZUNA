# Developer guide

This repository is a Django project split into module apps. Run commands from the repository root in PowerShell.

## Setup and run

Install the project's pinned dependencies and create or update its environment:

```powershell
uv sync
```

Start Django:

```powershell
uv run manage.py runserver
```

Open `http://127.0.0.1:8000/`. Django reloads Python and template changes automatically.

## Mieruka V0: launch and demo

The Mieruka app is implemented in `m11`–`m15` (plus `kizuna` and `frontend/`). `m1`–`m5` are reserved placeholders for teammates; they are not used by the app.

```powershell
uv sync
uv run manage.py migrate
uv run manage.py runserver        # http://127.0.0.1:8000
```

The built front end is committed in `assets/app/`, so Python alone is enough to run the app. To change the interface:

```powershell
cd frontend
npm install
npm run dev     # http://localhost:5173, proxies /api to Django on :8000
npm run build   # writes assets/app/ (commit it: Vercel serves it as static files)
```

Demo: open the site, click **Démo**, pick the household account, then press **Lancer** for each of the 8 steps (scan an adapter, trigger an air-conditioning fault, AI detection in about 15 seconds, apply the fix, savings and tokens, STEG building view, Tunisia–Japan). The reset button in the demo panel restores the dataset in under a second. Time is the real Tunis time; demo scenarios work at any hour.

`uv run manage.py mieruka_reset` resets the dataset from the command line.

If Windows application control blocks `.venv\Scripts\python.exe`, run `sh dj.sh runserver` from Git Bash (it uses the uv-managed interpreter with the venv's packages).

Settings: `MIERUKA_DEMO_CONTROLS=false` disables scenarios and reset; `MIERUKA_ADAPTER_KEY` makes `POST /api/mesures` require an `X-Adapter-Key` header.

## URL map

| Area | URL | Django app |
|---|---|---|
| Mieruka web app (React) | `/`, `/login`, `/app/…` | `kizuna` + `frontend/` → `assets/app/` |
| JSON API | `/api/` | routes in `config/api_urls.py` |
| M1 — Adapter and simulator | `/m1/` | `m1` |
| M2 — API and data | `/m2/` | `m2` |
| M3 — AI anomalies | `/m3/` | `m3` |
| M4 — User space and rewards | `/m4/` | `m4` |
| M5 — STEG space | `/m5/` | `m5` |
| Mieruka modules (shortcuts into the app) | `/m11/` … `/m15/` | `m11` … `m15` |
| Django admin | `/admin/` | Django admin |

Add routes in each app's `urls.py`; project-level prefixes are wired in `config/urls.py`. Views belong in the app's `views.py`. Shared landing-page templates are in `kizuna/`, and shared static assets are in `assets/`.

### Google login (M10)

Sign-in is at `/m10/` and uses Google through django-allauth. Set these environment variables (Vercel project settings for the hosted site, `.env.local` for local runs); never commit them:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console (type "Web application") |
| `GOOGLE_CLIENT_SECRET` | That client's secret |
| `MIERUKA_STAFF_EMAILS` | Comma-separated Google emails that get back-office access |

In the Google OAuth client, add these authorized redirect URIs: `https://kizuna-temp.vercel.app/accounts/google/login/callback/` and, for local runs, `http://127.0.0.1:8000/accounts/google/login/callback/`. Without the two Google variables the sign-in page says Google sign-in is not configured, and staff can still use "Staff password login".

### Database migrations on Vercel

`pyproject.toml` defines `[tool.vercel.scripts] build`, which runs `python manage.py migrate --noinput && python manage.py seed_demo --if-empty` during every Vercel build with that deployment's environment. Migrations therefore always reach the database the deployment uses, and simulated data is created only when the database is empty.

### Back office (M5)

The back office at `/m5/` is staff only. Sign in at `/m10/` with Google (see below) or, locally, with a Django staff account:

```powershell
uv run manage.py migrate
uv run manage.py createsuperuser
uv run manage.py seed_demo --reset   # simulated households, adapters, readings, alerts and credits
```

Then open `/m5/` and sign in. `seed_demo` refuses to run on a database that already has data unless you pass `--reset`, which replaces it. Check which database `.env.local` points to before running these commands; setting `TURSO_DATABASE_URL=` and `TURSO_AUTH_TOKEN=` to empty values in the shell keeps them on the local `db.sqlite3`.

## Module documentation

M5 (back office) and the M2 data models are built; the other module pages are scaffolds for the Mieruka subject (see [k-mod/mieruka-00-index.md](k-mod/mieruka-00-index.md)). Each app has a current-state log, specification and screenshot:

| App | Current state | Specification | Screenshot |
|---|---|---|---|
| Kizuna | [AI.log](kizuna/AI.log) | — | [home](kizuna/screenshots/home.png) |
| M1 | [AI.log](m1/AI.log) | [requirements](m1/mieruka-m1-adapter-simulator.md) | [preview](m1/screenshots/placeholder.png) |
| M2 | [AI.log](m2/AI.log) | [requirements](m2/mieruka-m2-api-data.md) | [preview](m2/screenshots/placeholder.png) |
| M3 | [AI.log](m3/AI.log) | [requirements](m3/mieruka-m3-ai-anomalies.md) | [preview](m3/screenshots/placeholder.png) |
| M4 | [AI.log](m4/AI.log) | [requirements](m4/mieruka-m4-user-space-rewards.md) | [preview](m4/screenshots/placeholder.png) |
| M5 | [AI.log](m5/AI.log) | [requirements](m5/mieruka-m5-steg-space.md) | [preview](m5/screenshots/placeholder.png) |
| M11 (Mieruka) | [AI.log](m11/AI.log) | energy model, seed, measurement contract | — |
| M12 (Mieruka) | [AI.log](m12/AI.log) | data model | — |
| M13 (Mieruka) | [AI.log](m13/AI.log) | AI rules | — |
| M14 (Mieruka) | [AI.log](m14/AI.log) | household space, tariff, rewards | — |
| M15 (Mieruka) | [AI.log](m15/AI.log) | STEG console | — |

## Common Django commands

Use `uv run` so each command uses the project's locked environment:

```powershell
# Check settings, installed apps and URL configuration
uv run manage.py check

# Create migration files after changing models
uv run manage.py makemigrations

# Apply migrations
uv run manage.py migrate

# Run all tests or only one app's tests
uv run manage.py test
uv run manage.py test m3

# Open the Django shell or create an admin login
uv run manage.py shell
uv run manage.py createsuperuser
```

Commit migration files with the model changes that generated them. Do not edit an already shared migration; create a new one instead.

To scaffold an app:

```powershell
uv run manage.py startapp my_app
```

Then add its `AppConfig` to `INSTALLED_APPS` in `config/settings.py`, create `my_app/urls.py`, and include it under a prefix in `config/urls.py`.

## Android testing and deployment

The `mobile` folder is the native Kotlin Android Studio project. Open `mobile` directly in Android Studio. The APK is a WebView client; Django continues to run on the development computer, not on the phone.

### Django static files on Vercel

Shared assets such as `assets/kizuna/logo.svg` are collected into `STATIC_ROOT` during Vercel's build and served from `STATIC_URL` by the Vercel CDN. Keep `STATIC_ROOT` configured in `config/settings.py`; Django templates should reference assets with the `{% static %}` template tag.

### Turso database on Vercel

The app uses local SQLite unless `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are configured. Remote Turso connections use Turso's SQL-over-HTTP driver. In Vercel, set both for each deployment environment you use and add a newly generated `DJANGO_SECRET_KEY`. Rotate any database token that has been shared in a screenshot or chat. Do not put secrets in URLs or commit them to the repository. Vercel deployments fail clearly when the required settings are missing instead of silently creating an ephemeral SQLite database.

For local development, the default remains `db.sqlite3`. To connect locally to Turso, create `.env.local` at the repository root with only the `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` values, omitting Vercel's `VERCEL` flag. The file is ignored by Git and loaded by `manage.py` for non-test commands. Vercel may not allow secret values to be pulled into that file; replace any `[SENSITIVE]` placeholders with a newly rotated token before using it. Run `uv run manage.py migrate` only after verifying which database the environment points to.

### Private file storage on Vercel

Uploaded files use a **Private** Vercel Blob store so they are only served through Django. Connect the store to the project's Production, Preview, and Development environments; Vercel supplies `BLOB_STORE_ID` and OIDC credentials. For local imports and development, run `npx vercel@latest env pull .env.local` after connecting Development. Never paste or commit the token values. Local development without Blob credentials continues to use the ignored `media/` directory.

### Test on a phone over the same LAN

1. Connect the phone and development computer to the same trusted Wi-Fi/LAN.
2. From the repository root, start the Django server and its local-network announcement:

   ```powershell
   .\run-kizuna.ps1
   ```

   The script chooses the active private IPv4 address, sets `DJANGO_ALLOWED_HOSTS`, and runs `uv run manage.py kizunaserver`. It can also be called by absolute path from another working directory. The server advertises itself with mDNS; the app discovers that service instead of scanning IP addresses. Keep this command running while testing. If prompted, allow inbound TCP port 8000 and UDP port 5353 on the trusted private network.
3. Open `mobile` in Android Studio, select the `app` run configuration and your connected phone, then click **Run**. The app connects to the advertised server automatically; there is no URL field. While searching and connecting, it displays the repository's `kizuna-loader.html` as a local Android asset; Gradle packages the file from the repository root, and the loader WebView blocks network requests. The installed version appears below the loader. The loader, native status text, offline screen, and system bars follow Android's light/dark theme. After each Django page loads, the app injects mobile-only CSS through JavaScript to match the page background and text to Android's current theme; the WebView stays hidden until the styling is applied. No browser controls or server address are shown. The mobile toolbar's menu opens the Django routes (`/`, `/m1/`, `/m2/`, `/m3/`, `/m4/`, and `/m5/`) on that same server, plus an offline **About Mieruka** page (project purpose, team logo animation, version) packaged in the app. For local testing, keep Django running with `.\run-kizuna.ps1`; no Vercel testing is needed. The hosted fallback (https://kizuna-temp.vercel.app/) loads if no LAN Django server is found; CI and release APKs load it directly, and a branded offline screen with a retry button appears if both servers are unreachable. After connecting, the app stops discovery and does not poll Django in the background.

HTTP is unencrypted and enabled only in debug builds. Use it only on a trusted network and never send real credentials or sensitive data.

### Android CI/CD

- Pushes and pull requests targeting `master`, `m1`, or `mobile`, plus manual **Mieruka Android APK** workflow runs, build the Android project and upload the `mieruka-android-apk` artifact (`mieruka-<version>.apk`).
- Every push to `master` (or `mobile`) builds the APK and, once the signing secret is set, publishes a GitHub Release on this repo. The version is the latest `vMAJOR.MINOR.PATCH` tag plus one patch (`v0.1.0` if there are no tags yet). Version tags also publish releases.
- The APK's Android `versionName` matches the release version, and `versionCode` is the GitHub Actions run number.
- In the foreground, the app checks GitHub's latest stable release every two minutes. When it finds a newer version, it asks once for that version whether to open the GitHub release page. **Open GitHub** opens the page in the user's browser; **Not now** dismisses the prompt. The **View update** button remains available. The app does not download or install APKs and does not request package-install permission. Android or Play Protect may still show its own security checks.
- The app ID is `com.zeroichi.mieruka`. Releases are signed with the Mieruka key (`mieruka.keystore`, alias `mieruka`, kept outside the repo). Store it base64-encoded as the Actions secret `MIERUKA_KEYSTORE_BASE64`: `base64 -w0 ~/.android/mieruka.keystore | gh secret set MIERUKA_KEYSTORE_BASE64 -R alcoholic-lain/KIZUNA`. Never commit the keystore. Without the secret, CI builds the APK artifact but skips the release. For a local build signed with the same key, pass `-PmobileDebugKeystore=<path to mieruka.keystore>`.
- CI builds open https://kizuna-temp.vercel.app directly. To use another server, set the `MOBILE_SERVER_URL` Actions variable or enter an origin as the `server_url` workflow input.
- Pushing a version tag such as `v0.1.0` builds the APK and publishes a stable release under that version tag. The APK is for sideloading, not a Play Store release. This workflow does not deploy Django.

For local builds, install Android Studio and the Android SDK, open `mobile` as the project, and run the `app` configuration on a connected device. The optional `-PmobileServerUrl=<origin>` Gradle property or `MOBILE_SERVER_URL` environment variable bypasses LAN discovery for a hosted server.

## Repository workflow

The shared integration branch is `master`. Module branches are `m1`, `m2`, `m3`, `m4`, `m5` and `m10`; Android packaging is maintained on `mobile`. Work on your assigned branch and open a pull request to `master`. Coordinate changes to shared settings, URLs or the `kizuna` UI.

```powershell
git status
git fetch origin
git switch m3
git pull

uv run manage.py check
uv run manage.py test m3
git add m3/
git commit -m "Describe the change"
git push
```

Replace `m3` with your module branch. Stage only files related to your change rather than using `git add .`, which can include unrelated work.
