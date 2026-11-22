# MIERUKA — 3D EXPERIENCE TECHNICAL AUDIT

**Product:** Mieruka (見える化, "visibility"). Team: Zero-Ichi. KIZUNA 2026 is the hackathon name, not the product.
**Repository:** `C:\Users\moonm\OneDrive\Desktop\KIZUNA` (git repo, branch `master`, working tree clean except untracked `.claude/`, `.idea/`, `env.download`).
**Task type:** Investigation only. No files modified, no dependencies installed, no implementation performed.

---

## 1. Executive summary

Mieruka is a Django 5.2 back-end with a React 19 / TypeScript / Vite front-end, deployed to Vercel, with a local SQLite database (Turso on production Vercel). It serves five user roles — foyer, etudiant, famille, entreprise, steg — through a single React SPA mounted at `/`, `/login`, and `/app/…`, plus Django-template module pages (`/m1/`…`/m5/`, `/m10/`, `/m11/`…`/m15/`) and a staff back office at `/m5/`.

**Key verified facts:**
- All energy values in the web app are **computed by a deterministic simulator** (`m11/model.py`, `m11/profiles.py`) unless real `Reading` rows exist (`POST /mesures`). Every simulated value is labelled `source: "simulee"` on screen.
- There is **no 3D library installed**: no `three`, `@react-three/fiber`, `@react-three/drei`, `babylon.js`, `gsap`, `lottie`, `spline`, `mapbox`, or `chart.js` in `frontend/package.json`. The only spatial library is `leaflet` (2D maps) plus `recharts` (2D charts).
- A **standalone Three.js r128 prototype** exists at `assets/3d/prototype.html` (loads Three.js from cdnjs), but it is **not integrated** into the React app, not bundled by Vite, and not referenced by any route.
- There are **two parallel data models** in one SQLite database: `m12.models` (used by the React JSON API) and `m2.models` (used only by the Django-template M5 back office at `/m5/`). They share the DB but use different tables.
- Role is single-valued (`Profile.role`); one household per profile; no multi-role, multi-organization, or role-switching for real accounts (switching exists only for the five demo accounts via `POST /api/auth/demo`).

**Recommendation in one line:** add `@react-three/fiber` + `three` + `@react-three/drei`, lazy-load 3D scenes by role route, keep Leaflet for maps and Recharts for 2D charts, provide reduced-motion / WebGL-unavailable fallbacks, and build role-specific 3D scenes only on top of real computed metrics (never fabricate readings).

---

## 2. Verified architecture

### 2.1 Languages and frameworks (from manifests)

| Layer | Technology | Version source |
|---|---|---|
| Backend language | Python (requires `>=3.14`) | `pyproject.toml:9` |
| Backend framework | Django 5.2.19 | `uv.lock:262-263`; `config/settings.py:4` docstring |
| Auth | django-allauth 65.22.1+ (Google OAuth only; local signup closed) | `pyproject.toml:12`, `config/settings.py:302-336` |
| Other back-end deps | python-dotenv, turso-serverless 0.1.0, vercel-blob 0.5.0, zeroconf 0.154.0 | `pyproject.toml:13-17` |
| Frontend language | TypeScript ~5.8.3 | `frontend/package.json:57` |
| Frontend framework | React 19.1.0 + React DOM 19.1.0 | `frontend/package.json:33-34` |
| Router | React Router 7.18.6 | `frontend/package.json:35` |
| Build tool | Vite 6.3.5 | `frontend/package.json:59` |
| Styling | Tailwind CSS 4.3.5 (@tailwindcss/vite) | `frontend/package.json:23,39` |
| Data fetching | @tanstack/react-query 5.108.2 | `frontend/package.json:24` |
| Animations | motion 12.43.0 (Framer Motion) | `frontend/package.json:30` |
| Charts | recharts 2.15.4 | `frontend/package.json:36` |
| Maps | leaflet 1.9.4 (+ @types/leaflet, d3-geo 3.1.2, topojson-client 3.1.0, world-atlas 2.0.2) | `frontend/package.json:27-28,40-41` |
| Icons | lucide-react 1.77.0 | `frontend/package.json:29` |
| UI primitives | @radix-ui/* (dialog, dropdown-menu, popover, select, slot, switch, tabs, tooltip) | `frontend/package.json:15-22` |
| Toasts | sonner 2.0.8 | `frontend/package.json:37` |
| Fonts | @fontsource-variable/geist, geist-mono 5.3.0 | `frontend/package.json:13-14` |
| QR | qr-scanner 1.4.2, qrcode 1.5.4 | `frontend/package.json:31-32` |

**Not present** (verified absent from `frontend/package.json` and `package-lock.json`): `three`, `@react-three/fiber`, `@react-three/drei`, `babylonjs`, `gsap`, `lottie-react`, `@splinetool/*`, `mapbox-gl`, `maplibre`, `chart.js`, `visx`. WebGL/WebGPU are only available indirectly via a library that would need to be added.

Python package manager: `uv` (`uv.lock`, `pyproject.toml` build-backend `uv_build`). Frontend package manager: npm (`package-lock.json`, `node_modules/` present).

### 2.2 Frontend architecture and entry points

- Source root: `frontend/src/`.
- Entry: `frontend/src/main.tsx:1` — `QueryClientProvider` + `BrowserRouter` + `App`, rendered into `#root`.
- Routes: `frontend/src/App.tsx:49-78` (React Router).
- Public routes: `/` → `Landing` (`frontend/src/pages/Landing.tsx`), `/login` → `Login` (`frontend/src/pages/Login.tsx`).
- App routes (all under `/app`, wrapped by `Guard` + `Shell`): `accueil` (Home), `appareils` (Devices), `analyse` (Insights), `recompenses` (Rewards), `explorer` (Explore index with tiles → comparer/flux/apprendre/profil), `entreprise` (Company, role `entreprise` only), `steg/*` (role `steg` only), `*` (NotFound).
- Build output: Vite builds into `assets/app/` (`frontend/vite.config.ts:12`, `base: "/static/app/"`), served as Django static files by `kizuna/views.py:spa` via template `templates/kizuna/spa.html:14`.
- Chunks (manifest `assets/app/.vite/manifest.json`): `index` (entry, imports react, radix, charts, motion), lazy chunks `react`, `radix`, `charts`, `motion`, `NetworkMap`, `Atlas`, plus `qr-scanner-worker`. Raw bundle sizes (un-gzipped, measured from `assets/app/assets/`): `index-DTzPt5dc.js` 504,156 B; `charts-CMRr44ub.js` 445,917 B; `react-Ct-UlXf4.js` 90,767 B; `motion-C2t6uAsH.js` 103,590 B; `radix-CE8uMjrj.js` 111,958 B; `NetworkMap-HZxFTVe4.js` 157,500 B; `Atlas-olgSk5_P.js` 20,676 B; `qr-scanner-worker.min-D85Z9gVD.js` 43,954 B; CSS `index-UrRIoVT0.css` 54,981 B. Exact **gzipped** bundle size: UNVERIFIED (not measured).
- Frontend communicates with the backend via `fetch` to `/api/<path>` (`frontend/src/lib/api.ts:19-34`), `credentials: "same-origin"`, `X-CSRFToken` read from the `csrftoken` cookie (`api.ts:4-7`), JSON body. Caching/polling via Tanstack React Query (`queryClient`, `useApi`), e.g. `live` refetched every 2500 ms (`Home.tsx:15`, `Shell.tsx:70`).

### 2.3 Backend architecture and entry points

- WSGI/ASGI: `config/wsgi.py`, `config/asgi.py`; Vercel entrypoint `config.wsgi:application` (`pyproject.toml:19-20`).
- URLs: `config/urls.py:1-22` — `/admin/`, `/accounts/` (allauth), `/api/` (`config/api_urls.py`), `/m1/`…`/m5/`, `/m10/`, `/mekeru/`, `/m11/`…`/m15/`, root `/` + `/login` + `/app/*` → `kizuna.urls` → `views.spa`.
- JSON API route ownership (`config/api_urls.py:11-58`):
  - `kizuna.api`: `auth/me`, `auth/login`, `auth/demo`, `auth/logout`, `auth/register`, `profile`, `benchmark`, `learn`, `learn/complete`.
  - `m11.api` + `m11.atlas`: `live`, `sim`, `mesures`, `adapters/check`, `adapters/registry`, `atlas`, `atlas/locate`, `atlas/roof`, `atlas/demo-adapter`, `atlas/device/<aid>`.
  - `m13.api`: `ai`, `alerts/<aid>`, `alerts/<aid>/apply`, `alerts/<aid>/ignore`, `recommendations/apply`.
  - `m14.api`: `home`, `devices`, `devices/<iid>`, `history`, `rewards`, `rewards/redeem`, `challenges/<code>`, `solidarity`, `company`, `flows`.
  - `m15.api`: `steg/overview`, `steg/buildings`, `steg/buildings/<code>`, `steg/households/<code>`, `steg/peak`, `steg/incidents`, `steg/incidents/<aid>/resolve`.
- Django-template (non-React) module pages: `/m1/`…`/m5/` and `/m11/`…`/m15/` render `templates/kizuna/module.html` (placeholder scaffolds). `/m10/` renders `templates/m10/index.html` (sign-in status). `/m5/` renders `templates/m5/*.html` (staff back office, server-rendered HTML, uses `m2.models` — see §2.7).
- `kizuna/views.py:spa` ensures demo seeding (`ensure_seeded`) and serves the built React app; `kizuna/views.py:module_page` renders reserved module placeholders.
- Management commands: `uv run manage.py {runserver, migrate, makemigrations, test, shell, createsuperuser, seed_demo, ensure_admin, kizunaserver}`; `kizuna/management/commands/kizunaserver.py` (LAN announcement + mDNS).

### 2.4 Database technology and model organization

- Local: SQLite `db.sqlite3` (`config/settings.py:180-191`), WAL journal, `IMMEDIATE` transaction mode, 20 s busy timeout (concise comment at settings.py:183-185 about the live simulator writing every 2 s).
- Production/Vercel: Turso (`libsql://`) via custom backend `config/db_backends/turso` (`settings.py:127-167`), selected when `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` (or `KIZUNA_*` for prod) are set.
- Migrations: Django migrations; every app with models has `migrations/`. Vercel build script runs `migrate --noinput && seed_demo --if-empty && ensure_admin` (`pyproject.toml:25-27`).
- File storage: Django `FileSystemStorage` locally (`media/`); private Vercel Blob (`config.blob_storage.PrivateVercelBlobStorage`) in production (`settings.py:194-220`).

**Primary data model (React API, `m12/models.py:18-252`):**
- `Region(code, name, lat, lon)` — 6 Tunisian regions seeded.
- `Building(code, name, district, region, kind [residentiel/entreprise/campus], meter_id, lat, lon, common_base_w, solar_kwc, common_fault_since)`.
- `Household(code, building, label, category [foyer/etudiant/famille/entreprise], occupants, housing_type, subscribed_kva, monthly_goal_kwh, is_live, unmonitored_base_w)`.
- `Profile(user OneToOne, role [foyer/etudiant/famille/entreprise/steg], household FK nullable, display_name, city, onboarded, is_demo)`.
- `Adapter(id PK like NABD-xxxx, seed)`.
- `Installation(adapter, household, name, category, room, usage_scale, year, start, end, monitoring)` — adapters installed on appliances for a period.
- `Reading(adapter, ts, watts, source [simulee/reelle])` — real measurements posted by hardware; unique (adapter, ts).
- `Alert(household, installation, building, kind, severity, title, cause, action, action_code, detected_at, measured, expected, unit, confidence, evidence JSON, kwh_month, status, resolved_at, resolved_by)`.
- `SavingAction(household, installation, alert, code, title, applied_at, reference_w, mode, window_hours)`.
- `TokenTx(household, ts, amount, kind [defi/education/communaute/depense/don/economie], label)`.
- `ChallengeEntry(household, code, completed_at)`.
- `SolidarityProject(code, title, kind, region, partner, goal_tnd, unit_cost_tnd)`; `Contribution(project, household, contributor, tokens, amount_tnd, ts)`.
- `LearningProgress(user, item, score)`.
- `SimState(pk=1, offset_minutes, version, seeded_at)` — demo clock.

**Parallel back-office model (`m2/models.py:14-159`, used ONLY by `/m5/` Django views):**
- `Utilisateur`, `Appareil`, `Adaptateur` (MIERUKA-xxxx), `Mesure` (adaptateur, horodatage, watts, source), `Alerte`, `Recompense(utilisateur, periode, kwh_evites, points)`. Separate tables from `m12`; not used by the React API.

**Simulator source of truth for computed values (`m11/model.py`, `m11/profiles.py`):** `CATALOG` of 18 appliance profiles with nominal watts, standby, duty cycles, hourly usage probabilities; `Spec`, `power()`, `day_hourly()`, `baseline()`, `forecast()`, `habits()`, `recommendations()`; `unmonitored_hourly`, `common_hourly`, `solar_hourly` for loads no adapter measures. Time is `SimState.offset_minutes` shifted real time (`m11/model.py:now`).

### 2.5 API architecture and endpoint conventions

- All JSON API under `/api/` (`config/api_urls.py`).
- Decorator `@api(methods=("GET",))` in `kizuna/apiutils.py:71-92`: JSON in/out, French error messages (`{"error": ...}`), demo auto-seeding via `ensure_seeded()`, 405 for wrong method, 500 catch-all.
- Auth endpoints are CSRF-exempt where needed (`m11/api.py:mesures` is `@csrf_exempt` and checks optional `X-Adapter-Key` header `MIERUKA_ADAPTER_KEY`).
- `POST /api/mesures` accepts a single reading or a batch (max 100), validates adapter exists, stores `Reading` rows, returns `acquittees/stored/duplicate`. This is the frozen measurement contract (also used by the Node simulator at `m1/simulator/server.mjs`, port 8787, which posts to `http://127.0.0.1:8000/mesures`).
- `GET /api/auth/me` returns authenticated status, demo accounts list, password, appliance categories, and the user's profile + household (`kizuna/api.py:22-37`).
- No OpenAPI/Swagger, no GraphQL, no versioned API (`/api/` only). Endpoint conventions are module-owned function-based views.

### 2.6 Authentication and authorization

- Django sessions + django-allauth (`settings.py:90-94`, `MIDDLEWARE` includes `allauth.account.middleware.AccountMiddleware`).
- `ACCOUNT_LOGIN_METHODS = {"email"}`, `ACCOUNT_SIGNUP_FIELDS = ["email*"]`, `ACCOUNT_EMAIL_VERIFICATION = "none"`, `SOCIALACCOUNT_AUTO_SIGNUP = True`.
- Google OAuth via `allauth.socialaccount.providers.google`; credentials `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from env; `MIERUKA_STAFF_EMAILS` grants `is_staff` → back-office (`m5`) access.
- Local sign-up is closed (`AccountAdapter.is_open_for_signup` returns False, `m10/adapters.py:38`); Google sign-up open.
- The React app additionally offers email/password `auth/login` and `auth/register` (`kizuna/api.py:46-103`) creating plain Django users; `register` restricts role to `foyer/etudiant/famille/entreprise` (default `foyer`), **not** `steg`.
- `POST /api/auth/demo` (`kizuna/api.py:59-74`) switches between the five demo accounts (foyer/etudiant/famille/entreprise/steg), password `mieruka2026` (`m11/seed.py:19`, `DEMO_ACCOUNTS` at seed.py:42-48). Only works when `MIERUKA_DEMO_RESET` allows (`demo_reset_allowed`, `apiutils.py:31-32`); otherwise 503 and auto-reset.
- `SESSION_COOKIE_AGE = 7 days` (`settings.py:357`). `LOGIN_URL = "m10:index"`.
- Android Google sign-in uses phone browser + signed handoff token (`mekeru/views.py:app_return/app_handoff`, `mieruka://login`).

### 2.7 User-role handling

- Role stored in `Profile.role` (`m12/models.py:63-71`), choices `foyer/etudiant/famille/entreprise/steg`. Exactly one role per user; `Profile` is OneToOne to `User`.
- `Household.category` (`m12/models.py:46-61`) choices `foyer/etudiant/famille/entreprise` — **no `steg`**. STEG profiles have no household.
- `household_of(request)` (`kizuna/apiutils.py:53-61`): rejects `steg` (403 "réservé aux foyers et aux entreprises"); auto-creates a household for non-demo non-steg profiles without one (`m11/seed.py:create_household_for`).
- `require_steg(request)` (`kizuna/apiutils.py:64-68`): 403 unless `role == "steg"`; guards all `/api/steg/*` and `/api/atlas/*` endpoints (`m11/atlas.py:202`, `m15/api.py`).
- Frontend `Guard` (`frontend/src/App.tsx:18-32`): `roles` prop; redirects to `homeFor(role)` (`session.ts:20`: steg → `/app/steg`, entreprise → `/app/entreprise`, else `/app/accueil`).
- `Shell` nav (`frontend/src/components/Shell.tsx:21-45`): `household`, `company`, `steg` nav records; `steg` gets atlas/buildings/incidents/peak; `entreprise` gets entreprise page.
- Demo role switching via `useSwitch` → `POST /api/auth/demo {role}` (`session.ts:22-31`). Real users cannot switch roles.
- Staff: `user.is_staff` (set by Google staff-email list in `m10/adapters.py:27-34`, `mekeru/adapters.py:36-38`); `mekeru.ensure_profile` gives `role="steg"` to staff (`mekeru/adapters.py:19`).

### 2.8 Routing and navigation

- Django URLconf + React Router `BrowserRouter` (`frontend/src/main.tsx:17`).
- Django catches `/`, `/login`, `/app/(.*)` → SPA (`kizuna/urls.py:8-9`); React Router handles the rest client-side.
- Frontend route list: `App.tsx:55-74`. `steg/atlas` is lazily loaded (`Suspense`, `App.tsx:15`, `72`); `NetworkMap` lazy (`Steg.tsx:13`).
- Mobile: bottom tab bar (`Shell.tsx:120-128`); desktop: left sidebar (`Shell.tsx:83-102`).
- Android client (`mobile/`) is a Kotlin WebView that loads Django routes (`/`, `/m1/`…`/m5/`) on a discovered LAN server, with `kizuna-loader.html` as a local asset (`DEV.md:182-224`).

### 2.9 Build and deployment architecture

- Frontend: `npm run build` = `tsc -b && vite build` → `assets/app/` (`frontend/package.json:8`, `vite.config.ts:12`). Django collects `assets/` (`STATICFILES_DIRS`, `settings.py:284`) into `STATIC_ROOT=staticfiles` (`settings.py:285`).
- Backend: `uv run manage.py runserver` locally; Vercel via `config.wsgi:application`; build runs migrations + conditional seed + admin (`pyproject.toml:25-27`).
- No Dockerfile, no docker-compose found in repo (UNVERIFIED whether any exist outside root listing — none seen).
- CI/CD: GitHub Actions builds Android APK on pushes to `master`/`mobile` and tags (`DEV.md:214-222`); does not deploy Django.

### 2.10 Static assets and generated bundles

- `assets/` is `STATICFILES_DIRS` (`settings.py:284`). Subdirs: `assets/app/` (built React bundle + manifest), `assets/3d/` (`prototype.html` only), `assets/atlas/` (9 OSM extracts `tunis/sfax/sousse/kairouan/kef/gafsa/gabes/tataouine/tozeur.json` + README), `assets/kizuna/`, `assets/mieruka/`, `assets/app/` fonts.
- Mieruka brand: `assets/mieruka/mieruka-app-icon-v8-rounded.svg` (favicon, `#CD181F`), animated logo `assets/mieruka/zero-itchi-fun-logo-animated.svg`.
- KIZUNA event assets in `assets/kizuna/` (logos, partner images: esprit, jica, association-tunisie-japon) used on Landing page.
- `kizuna-loader.html` at repo root: packaged into the Android app as a local asset; inline SVG animation, no network.

### 2.11 Existing testing infrastructure

- Backend: Django `TestCase`/`SimpleTestCase` in `kizuna/tests.py` (LAN address command tests), `m11/tests.py`, `m12/tests.py`, `m13/tests.py`, `m14/tests.py`, `m15/tests.py`, `m2/tests.py`, `m3/tests.py`, `m5` has no tests.py listed (m5 dir has no tests.py — verified from listing). Run via `uv run manage.py test` / `uv run manage.py test <app>` (`DEV.md:164-165`).
- Frontend: **no test framework** (no vitest, jest, @testing-library, cypress, playwright in `frontend/package.json` or devDependencies). Frontend tests: UNVERIFIED/absent.
- E2E: none found.

### 2.12 Current Git branch and working-tree status (read-only)

- Branch: `master` (active). Remote `origin`; remote branches include `origin/master`, `origin/integrate/mieruka-unified`, `origin/kinto4869/steg-railway-readings`, `origin/m1/headless-adapter`, `origin/mieruka-v0`. Local branches: `master`, `mieruka-v0`, `backup/local-work-2026-11-22`.
- Working tree: clean except untracked `.claude/`, `.idea/`, `env.download`. No changes staged or modified. Last commit: `ca14a65 Rebuild frontend bundle from integrated source (tsc -b && vite build)`.

---

## 3. Five-role implementation audit

### 3.1 How roles map to accounts (verified from `m11/seed.py`)

| Role | Demo account | Building | Household label | City |
|---|---|---|---|---|
| foyer | `amira` / `amira@demo.mieruka.tn` | BAT-TUN-01 Résidence Les Jasmins | Foyer Ben Salah | Tunis |
| etudiant | `youssef` / `youssef@demo.mieruka.tn` | BAT-SOU-01 Foyer universitaire Sahloul | Studio de Youssef | Sousse |
| famille | `leila` / `leila@demo.mieruka.tn` | BAT-SFX-01 Îlot El Bousten | Famille Gharbi | Sfax |
| entreprise | `carthage` / `energie@demo.carthage-textile.tn` | BAT-TUN-03 Carthage Textile | Carthage Textile | Ben Arous |
| steg | `steg` / `analyste@demo.steg.tn` | — (no household) | Analyste STEG | Tunis |

Password for all demo accounts: `mieruka2026` (`m11/seed.py:19`).

### 3.2 Per-role detail

#### Foyer (`role="foyer"`)
1. Account creation: `POST /api/auth/register` with `role="foyer"` (or Google → default `foyer` via `mekeru.ensure_profile` unless staff). Demo: `auth/demo {role:"foyer"}`.
2. Role storage: `Profile.role="foyer"`, `Profile.household` FK to a `Household(category="foyer")`.
3. Permissions: household-scoped APIs (`home`, `devices`, `history`, `rewards`, `challenges`, `solidarity` token donations, `flows`, `ai`); `household_of` 403s steg only. Frontend `Guard roles={["foyer","etudiant","famille","entreprise"]}`.
4. Routes: `/app/accueil`, `/app/appareils`, `/app/analyse`, `/app/recompenses`, `/app/explorer` (+ comparer/flux/apprendre/profil), `/app/profil`.
5. APIs: all household APIs listed above + `auth/me`, `profile`.
6. DB: own `Household`, its `Installation`s, `Adapter`s, computed energy (`m11` model) or `Reading`s, `Alert`s, `SavingAction`s, `TokenTx`s, `ChallengeEntry`s, `LearningProgress`s, `SolidarityProject`/`Contribution` (read/donate tokens).
7. Functional: pairing adapters (QR/manual + GPS locate), live power curve, daily/monthly totals, IA alerts with apply/ignore, recommendations apply, challenges claim, eco-score, tokens ledger, catalog redeem, bill estimate (STEG tariff), history ranges.
8. Incomplete/visual: none major for foyer within the household scope; the "adapter" is always simulated unless real `Reading`s posted (no real hardware integrated).
9. Data specific: own household readings/appliances, own forecast, own bill, own tokens.
10. Interactions: scan/pair adapter, rename/room/monitoring toggle, unpair, apply recommendations, claim challenges, donate tokens, view history.

#### Étudiant (`role="etudiant"`)
Same technical surface as foyer. Demo household is a studio in a `campus` building (BAT-SOU-01, 9 background student households). Category `"etudiant"`. Challenges `veille-zero`, `sous-reference`, `soiree-douce` apply (`for: ["foyer","etudiant","famille"]`). `atelier-pointe` is `entreprise`-only. Functionally identical to foyer in code; no student-specific features beyond the campus building context and category label.

#### Famille (`role="famille"`)
Same as foyer. Demo household: 5 occupants, house, BAT-SFX-01. Challenges `veille-zero`, `sous-reference`, `soiree-douce`. Household shared by one profile in the demo (`leila`); `Profile.household` is a single FK — multiple family members cannot each have a profile linked to the same household in the current demo (one profile per household in seed), though the DB schema (`Household.members` related_name on Profile) technically permits multiple profiles pointing to one household. UNVERIFIED whether the UI supports multiple members of one household.

#### Entreprise (`role="entreprise"`)
1. Creation: `register` role `"entreprise"` or Google (default foyer unless staff). Demo `carthage`.
2. Role storage: `Profile.role="entreprise"`, `Household.category="entreprise"` (BAT-TUN-03 kind="entreprise").
3. Permissions: household APIs + `POST /api/company` (403 unless entreprise, `m14/api.py:99-101`), `solidarity` with `amount` contributions (403 for foyer/famille/etudiant donating dinars: "Dons en dinars réservés aux entreprises").
4. Routes: all household routes + `/app/entreprise`.
5. APIs: `company`, `solidarity` (contribute), plus household APIs.
6. DB: entreprise household + business installations (compresseur, machine_industrielle, eclairage_pro, serveurs — `business=True` profiles in `m11/profiles.py:62-71`), `Contribution`s with `tokens=0`.
7. Functional: 30-day consumption, CO₂, peak share, sponsored solidarity, catalog/redeem, challenges (`sous-reference`, `atelier-pointe`).
8. Incomplete/visual: "business sites and equipment" exist as categories but there is no multi-site dashboard; one household = one enterprise site.
9. Data: own enterprise meters, sponsored contributions.
10. Interactions: fund solidarity projects (simulated payment, "Paiement simulé" noted in `Company.tsx:45`).

#### STEG (`role="steg"`)
1. Creation: only via Google with email in `MIERUKA_STAFF_EMAILS` → `is_staff=True` → `ensure_profile` role `"steg"` (`mekeru/adapters.py:19`). `register` cannot create steg. Local `createsuperuser` + staff login works for `/m5/` back office (`DEV.md:119-127`).
2. Role storage: `Profile.role="steg"`, `Profile.household=NULL`.
3. Permissions: `require_steg` on `/api/steg/*` and `/api/atlas/*`; `household_of` 403 for steg. Frontend `Guard roles={["steg"]}` on `/app/steg/*`.
4. Routes: `/app/steg`, `/app/steg/atlas`, `/app/steg/batiments`, `/app/steg/batiments/:code`, `/app/steg/foyers/:code`, `/app/steg/incidents`, `/app/steg/pointe`, `/app/comparer` (desktop only).
5. APIs: `steg/overview`, `steg/buildings`, `steg/buildings/<code>`, `steg/households/<code>`, `steg/peak`, `steg/incidents`, `steg/incidents/<aid>/resolve`, `atlas`, `atlas/locate`, `atlas/roof`, `atlas/demo-adapter`, `atlas/device/<aid>`, `live` (ticker only).
6. DB: read-only-ish access to all Households/Buildings/Alerts (aggregated); can `resolve` incidents; can create demo adapters (`atlas/demo-adapter`) and locate any adapter (`_adapter_for` allows any for steg, `m11/atlas.py:184-186`). Cannot create households via API.
7. Functional: national/regional overview, building list with equation (meter = monitored + untracked), building detail with pseudonymized households, incidents list + resolve, peak/heatmap, atlas map of ~1,000 simulated adapters, privacy masking (<10 households → `masked: true`, no aggregates).
8. Incomplete/visual: "digital twin" and "national network" are aggregates computed in Python, not real SCADA/AMI data. Network map is Leaflet 2D, not 3D.
9. Data: all households/buildings (pseudonymized codes `FY-xxxx`), regional aggregates, incidents, live ticker.
10. Interactions: resolve incidents, view building/household detail, atlas device inspection, generate/scan demo adapters.

### 3.3 Multi-role / multi-organization / switching

- **Multiple roles per person:** No. `Profile.role` is a single `CharField`; one `Profile` per `User` (OneToOne). A person cannot be both foyer and steg.
- **Multiple organizations/households:** No. `Profile.household` is a single nullable FK. A household can technically have multiple member profiles (related_name `members`), but the demo seeds one profile per live household and the UI never exposes household switching or membership management.
- **Switching experiences:** Only via `POST /api/auth/demo` among the five hard-coded demo accounts (`m11/seed.py:DEMO_ACCOUNTS`), used by the frontend role switcher (`session.ts:useSwitch`) and Login page. Real accounts have a fixed role. No organization switching.

---

## 4. Data and functionality inventory

Legend for the "Nature of data" column:
- **SIM** = simulated, computed by `m11/model.py` appliance model (deterministic, labelled `simulee`).
- **REAL** = stored `Reading` rows from `POST /api/mesures` (hardware contract; no real hardware integrated).
- **DERIVED** = computed from SIM/REAL (forecasts, bills, scores, tokens).
- **STATIC** = seeded/demo reference data (catalog, tariff table, benchmarks).
- **UI-ONLY** = visual with no backend model.

| Capability | Frontend implementation | Backend implementation | Database source | API | Nature of data | Status |
|---|---|---|---|---|---|---|
| Users & profiles | Login, register, profile page (`Login.tsx`, `Explore.tsx:Profile`) | `kizuna.api` (`me`, `register`, `update_profile`, `do_login/`) | `auth_user`, `m12_profile` | `auth/me`, `auth/login`, `auth/register`, `profile`, `auth/demo` | REAL (accounts) | Fully functional |
| Authentication | Login demo switcher, Google button | django-allauth + session auth; `m10`/`mekeru` adapters | `auth_user`, `socialaccount` | `auth/login`, `auth/logout`, `/accounts/`, `/mekeru/google/` | REAL | Fully functional (Google needs env creds) |
| Adapters & pairing | Devices page, AddDevice QR/manual, GPS (`Devices.tsx`) | `m14.services.pair/device_detail/unpair`, `m11.api.adapter_check/registry` | `m12_adapter`, `m12_installation` | `devices`, `devices/<iid>`, `adapters/check`, `adapters/registry` | REAL (records) | Fully functional |
| Measurements & telemetry | Live curve, series, device readings | `m11.api.mesures` (POST, batch ≤100); `m11/model.real_live/measured_power` | `m12_reading` | `mesures`, `live` | SIM unless `Reading`s posted | Fully functional (SIM default) |
| Energy consumption calc. | Home kWh/kW, bill, history charts | `m11/model.power/day_hourly`, `m12/data.matrix/totals/live_power` | computed (no TS table) | `home`, `live`, `history`, `device/<iid>` | SIM/REAL → DERIVED | Fully functional |
| Locations & GPS | Atlas map, device position, roof pin (`Atlas.tsx`, `NetworkMap.tsx`) | `m11.api.locate/roof/device`, `AtlasLocation` | `m11_atlaslocation` | `atlas/locate`, `atlas/roof`, `atlas/device/<aid>` | REAL (phone fixes) + SIM positions | Fully functional |
| Installations & buildings | Devices list, STEG buildings table | `m12.models` + `m12.data.installations` | `m12_building`, `m12_household`, `m12_installation` | `home`, `steg/buildings`, `steg/households/<code>` | SIM records | Fully functional |
| Alerts & anomaly detection | AlertPanel, Insights alerts tab, incident dialog | `m13.engine.scan` rules; `m13.api` | `m12_alert` | `ai`, `alerts/<aid>`, `alerts/<aid>/apply`, `alerts/<aid>/ignore`, `steg/incidents` | SIM-derived (rule-based) | Fully functional |
| Insights & analytics | Insight tabs (alertes/conseils/historique/prevision), benchmark | `m13.engine.forecast/habits/recommendations`, `kizuna.api.benchmark` | computed | `ai`, `benchmark` | SIM → DERIVED | Fully functional |
| Rewards & token tx | Rewards page (ledger, ring, catalog, daily bar) | `m14.rewards.savings/ledger/score_bundle/apply_claim`; `m14.api.rewards/redeem/challenge` | `m12_tokentx`, `m12_challengeentry` | `rewards`, `rewards/redeem`, `challenges/<code>` | SIM → DERIVED | Fully functional |
| Challenges & missions | Challenges cards + claim button | `m14.rewards.CHALLENGES`, `claim` | `m12_challengeentry` | `challenges/<code>` | SIM-verified checks | Fully functional |
| Social / community | Solidarity projects + donate (tokens/DT) | `m14.services.solidarity/donate/contribute` | `m12_solidarityproject`, `m12_contribution` | `solidarity` | SIM (labelled simulé) | Fully functional |
| Family / organization | Shared household label; one profile per household demo | `Profile.household` FK | `m12_household`, `m12_profile.members` | `home`, `profile` | SIM | Partially (no multi-member UI) |
| Business sites & equipment | Company page | `m14.services.company` | `m12_household` (cat=entreprise), business profiles | `company` | SIM | Fully functional (single site) |
| STEG network & Atlas | StegNetwork, StegBuildings, Atlas page | `m15.aggregates`, `m11.atlas.snapshot` | `m12_*`, `m11_atlaslocation` | `steg/overview`, `steg/buildings`, `steg/peak`, `steg/incidents`, `atlas/*` | SIM aggregates (~1000 adapters) | Fully functional |
| Reports & history | History page (jour/semaine/mois/annee/perso) | `m14.services.history` | computed from model/readings | `history` | SIM/REAL | Fully functional |
| External integrations | Google OAuth, Leaflet OSM tiles | allauth Google; `tile.openstreetmap.org` | none | `/accounts/`, `/mekeru/google/` | REAL (OAuth) | Fully functional (Google needs creds) |

**Dashboard metric sources (verified):**
- Current power / today kWh / tokens: `GET /api/live` → `m14.services.live` → `m11` model (`SIM`) or `Reading` (`REAL`). Labelled `source` in response.
- Monthly bill (DT): `m14/tariff.py:monthly_bill` (STEG residential tariff since 01/05/2022, labelled estimate) → `services.home` → `home.bill`.
- Eco-score / parts / history: `m14/rewards.py:eco_score/score_bundle` → `rewards.score`.
- Forecast (month kWh, low/high): `m13/engine.py:forecast` → `home.forecast`, `ai.forecast`.
- CO₂: factor `0.468 kg/kWh` (IEA screening average, `m12/data.py:12`, `m14/tariff.py:SOURCE`).
- Savings kWh: `m14/rewards.py:savings` (integrated vs reference_w, computed not stored).
- STEG overview/live_w/today/month: `m15/aggregates.py:overview` (computed from matrix; `engine.scan_background` for network-wide incidents).
- Benchmark Tunisia/Japan: `kizuna/benchmarks.py` (STEG 2019 survey, Japan MOE 2023) — STATIC sourced data.
- Tokens per kWh = 500, daily cap 400 (`m14/rewards.py:18-19`).

**Backend data sufficiency:** The backend has real relationships (users→profiles→households→buildings→installations→adapters) plus computed energy and alerts, enough to power consumption visualizations, maps, alerts, rewards, and the STEG aggregated view. It does **not** have: real hardware telemetry (only simulated unless `Reading`s posted), multi-site enterprise data, real-time equipment control, weather API data, or 3D scene data. All energy figures are derived from the deterministic model, not measured — acceptable for the prototype but must be labelled `simulee` (rule in README & k-mod: "Shown in the product: Simulated data wherever simulated values appear").

---

## 5. Existing front-end and design system audit

### 5.1 Design system
- Tailwind CSS v4 (`@tailwindcss/vite`), custom-variant `dark`, CSS theme tokens in `frontend/src/index.css:7-38` (oklch): `--color-bg`, `--color-card`, `--color-muted`, `--color-line`, `--color-ink/2/3`, `--color-brand` (oklch 0.55 0.21 25, red-orange), `--color-energy` (0.8 0.16 80), `--color-good/warn/bad/info`, semantic `--color-c0…c8` palette for appliance categories.
- Fonts: Geist Variable (sans) + Geist Mono Variable, via `@fontsource-variable`, self-hosted woff2.
- Dark mode: `.dark` class toggled from `localStorage` ("theme"), respected by `color-scheme`; CSS `prefers-reduced-motion: reduce` disables all animation/transition (`index.css:69`).
- Layout: desktop left sidebar (`lg:pl-60`), mobile bottom tab bar; sticky header.

### 5.2 Component library
Custom components built on Radix UI primitives (`frontend/src/components/ui.tsx`): Button, Card, CardTitle, Badge, Dialog, Tabs, Switch, Input, Field, Progress, AnimatedNumber, Delta, Stat, LiveDot, Skeleton, Empty, BackLink, PageHeader, InfoTip/Tip, Tooltip. Plus `charts.tsx` (LiveArea, Bars, Lines, Donut, Spark, Ring, Legend on recharts), `NetworkMap.tsx` (leaflet), `AlertPanel.tsx`, `ErrorBoundary.tsx`, `DemoGuide.tsx`.

Icons: lucide-react throughout.

### 5.3 Navigation patterns
Sidebar nav role-dependent (`Shell.tsx:21-45` NAV records); mobile bottom tabs; guided demo coach-mark (`DemoGuide.tsx`); deep links (`?alerte=`, `?scan=`, `?ajouter=1`).

### 5.4 Responsive behavior
Breakpoint-based sidebar vs bottom nav; cards and grids responsive (`lg:grid-cols`); Leaflet map sized by container; canvas-based 3D (prototype) uses `clamp` heights. Not formally tested on specific devices.

### 5.5 Existing animations and transitions
- `motion` (Framer Motion v12): page entry fades, `AnimatedNumber`, `Progress` bar, `Ring` stroke-dashoffset, `motion.button` hover/tap in `Learn`, `AnimatePresence` in `Devices` sheets, `DemoGuide`, `Layout` in `Atlas`.
- CSS: `pulse-ring` (`LiveDot`), `animate-pulse-ring`/`animate-spin` utilities.
- Reduced motion: globally disabled in `index.css:69`.

### 5.6 Existing charts & visualization libraries
- recharts 2.15.4 (Area, Bar, Line, Pie charts) wrapped in `components/charts.tsx`.
- Custom SVG Sankey in `Explore.tsx:Sankey` (energy flows, animated dashed motion.path).
- Heatmap grid in `Steg.tsx:StegPeak` (CSS `color-mix` cells).
- Leaflet 1.9.4 with OpenStreetMap tiles (`lib/atlas.ts:themedTiles`) for national atlas + neighbourhood street/building extracts (`assets/atlas/*.json`, topojson/world-atlas installed but their use is limited to `atlas.ts` types; `pack()` fetches `assets/atlas/<id>.json`).

### 5.7 Existing icon libraries
lucide-react only.

### 5.8 Reusable components
`ui.tsx` primitives, `charts.tsx`, `NetworkMap.tsx`, `lib/api.ts`, `lib/session.ts`, `lib/atlas.ts`, `lib/categories.ts`, `lib/format.ts`, `lib/gps.ts`. These can be reused; 3D needs new components.

### 5.9 Visual assets
- Brand SVG icons (mieruka app icon, zero-itchi logo animated/static), KIZUNA event logos + partner images, `kitty.png`, `assets/3d/prototype.html` (standalone).
- No GLB/GLTF models, no 3D textures, no HDR environment maps in the repo.

### 5.10 Loading and error states
`Skeleton` placeholders, `sonner` toasts, `ErrorBoundary`, offline banner (`Shell.tsx:111-115`), empty states (`Empty`), `ApiError` French messages.

### 5.11 Role-specific design differences
Only navigational (Shell NAV) and route-gating (`Guard roles`). Home page greets entreprise by full name (`Home.tsx:26`). Colors/charts identical across roles. No role-specific palettes.

---

## 6. 3D and immersive web capabilities

### 6.1 Libraries actually installed (verified in manifests)

| Capability | Installed? | Evidence |
|---|---|---|
| Three.js | No | absent from `frontend/package.json` dependencies/devDependencies |
| React Three Fiber | No | absent |
| Drei | No | absent |
| Babylon.js | No | absent |
| WebGL / WebGPU | No direct lib | browser APIs only, not exposed by any dependency |
| GSAP | No | absent |
| Framer Motion / motion | Yes | `motion 12.43.0` (`package.json:30`) |
| Lottie | No | absent |
| Spline | No | absent |
| Mapbox / MapLibre | No | absent |
| Leaflet | Yes | `leaflet 1.9.4` + `@types/leaflet` (`package.json:28,47`) |
| Charting (2D) | Yes | `recharts 2.15.4` |
| d3-geo / topojson / world-atlas | Yes | `d3-geo 3.1.2`, `topojson-client 3.1.0`, `world-atlas 2.0.2` |
| GLB/GLTF loader support | N/A (no 3D lib) | absent |
| Shader / custom material support | N/A (no 3D lib) | absent |

The only 3D code in the repo is `assets/3d/prototype.html`: a **standalone** single-file page that loads Three.js r128 from `cdnjs.cloudflare.com` (CDN, not a dependency), renders a textured smart-plug model, and labels data "simulated". It is **not** imported, bundled, or routed by the React app. It is a reference prototype, not integration.

### 6.2 Approach evaluation (for this exact stack)

**A. React Three Fiber + Drei (recommended)**
- Compatibility: React 19 + Vite + TypeScript — excellent. Installs as npm packages (`three`, `@react-three/fiber`, `@react-three/drei`). Coexists with Recharts/Leaflet/motion.
- Integration complexity: moderate. Needs new components under `frontend/src/components/`, lazy-loaded route chunks, Vite asset handling for GLB/HDRI, CSS overlay layering on top of the existing Shell.
- Performance: good on mid-range devices if scenes are small, instanced, and rendered only when visible; R3F adds ~60-100 kB gzipped (three ~200-300 kB). Must lazy-load so the initial bundle is untouched.
- Mobile: WebGL 2 widely supported on mid-range Android; needs fallback, reduced motion, low-poly models.
- Asset pipeline: GLB/GLTF via `public/` or `assets/`, loaded with `useGLTF` (drei) and `useProgress`.
- Interactivity: raycasting via drei `<Events>`, pointer events, HTML overlays.
- Maintainability: declarative React, fits existing codebase conventions.
- Suitable for five roles: yes — each role gets its own lazy scene component sharing a common `SceneWrapper`/fallback.

**B. Vanilla Three.js integrated through React (useRef/useEffect)**
- Compatibility: fine but fights React's render cycle; imperative, harder to keep in sync with React state.
- Integration complexity: higher than R3F for interactive scenes; more boilerplate.
- Performance: similar to R3F (same engine), but no drei helpers (OrbitControls, useGLTF, HTML) means more custom code.
- Mobile/Asset/Interactivity: same engine, more custom work.
- Maintainability: lower — not idiomatic in this React codebase.
- Suitable: possible but not recommended for five role-specific scenes.

**C. Spline embeds**
- Compatibility: iframe/script embed, no React integration complexity.
- Integration complexity: low to embed, high to drive live data (Spline parameters via JS are limited and version-fragile).
- Performance: Spline handles rendering; bundle impact near-zero, but runtime weight and network load on the embed.
- Mobile: decent, but WebGL dependency remains.
- Asset pipeline: Spline editor (external), exports URL — not version-controlled with the repo.
- Interactivity: limited event callbacks; hard to tie to `/api/live` readings deterministically.
- Maintainability: low — visual authoring outside the codebase, hard to review/diff, data binding is awkward.
- Suitable: only for isolated decorative hero scenes, not data-driven role experiences.

**D. Pre-rendered 3D assets with interactive React overlays**
- Compatibility: trivial (images/video).
- Integration complexity: low.
- Performance: best on low-end devices.
- Mobile: excellent.
- Asset pipeline: external rendering tooling needed.
- Interactivity: limited to hotspots; no real-time 3D interaction.
- Maintainability: high for static visuals, low for anything data-driven.
- Suitable: decorative illustrations only, not functional energy visualizations.

**E. Hybrid (R3F for functional scenes + pre-rendered/decorative overlays + Leaflet for maps)**
- Best fit: combines A + D, keeping Leaflet for geography (already integrated) and R3F for object/energy scenes.

### 6.3 Recommended architecture

- Stack: `three` + `@react-three/fiber` + `@react-three/drei`, added to `frontend/package.json` (not installed in this audit per rules).
- Scene components live in `frontend/src/components/scene/` (or per-feature), lazy-loaded with `React.lazy` behind role routes in `App.tsx`, wrapped by a shared `Suspense` fallback and a WebGL-availability guard.
- Shared: `<MierukaScene>` wrapper (camera, lights, `useFrame` only when visible, `dpr` cap, `powerPreference: "high-performance"` optional), reduced-motion detection (`useMediaQuery("(prefers-reduced-motion: reduce)")`), fallback to a 2D Recharts/CSS rendering.
- Data: scenes read from the same Tanstack Query hooks (`useApi("live")`, etc.) already used; no new API contract needed for phase 1. 3D visualizes existing computed metrics.
- Assets: GLB/GLTF in `frontend/public/models/` (or `assets/`), textures compressed; no procedural geometry at scale.
- Do NOT use Spline for data-driven features; do NOT use vanilla Three.js imperative code for new scenes; keep maps in Leaflet.

---

## 7. AI component handoff workflow

### 7.1 Deliverable integration assessment

| Deliverable | Integrates cleanly? | Notes |
|---|---|---|
| Reusable React TSX components | Yes | Follow `ui.tsx`/Radix conventions, Tailwind v4, oklch tokens; place in `frontend/src/components/` |
| Three.js scenes | Partially | Requires adding `three` + `@react-three/fiber` deps; wrap as React components; lazy-load |
| React Three Fiber components | Partially | Same as above; preferred over vanilla Three.js |
| GLB/GLTF 3D models | Yes | Vite copies static assets; load via `useGLTF` from `public/models/`; verify sizes for mobile |
| Textures / env maps | Yes | Same pipeline as GLB; compress (basis/KTX2 ideally) |
| GLSL shaders | Partially | Custom `ShaderMaterial`/`onBeforeCompile` works in R3F; harder to maintain, keep minimal |
| CSS animations | Yes | Tailwind/motion; respect `prefers-reduced-motion` |
| SVG illustrations | Yes | Inline SVG or `assets/`, lucide-compatible |
| Lottie animations | No | `lottie-react` not installed; adds bundle weight; prefer CSS/motion or video |
| Standalone HTML prototypes | No | Not routable; usable only as reference (like `assets/3d/prototype.html`) |

### 7.2 Recommended handoff contract

**File & folder structure** (under `frontend/src/`):
```
components/energy/<Feature>/
  index.ts            # public entry (named export Feature)
  Feature.tsx         # component
  Feature.types.ts    # props + events types
  Feature.test.tsx    # optional co-located test
  assets/             # GLB/textures only if tiny; else reference public/models/
lib/energy/           # scene helpers (camera preset, fallback guard, dpr cap)
```

**Component entry point:** named default export + named export `Feature` from `index.ts`; register lazy route in `App.tsx` via `React.lazy(() => import("./components/energy/<Feature>"))`.

**Dependencies:** must declare: React 19, and for 3D `three`, `@react-three/fiber`, `@react-three/drei`. Must not introduce unlisted peer deps. State: receive data via props only; do not call backend directly inside the 3D scene (pass fetched data down).

**Props & data inputs:** `data: Readonly<MetricSnapshot>` (already-shaped numbers), `role: "foyer"|"etudiant"|"famille"|"entreprise"|"steg"`, `className?`, `onEvent?(payload)`, `onError?(error)`, `reducedMotion: boolean`, `width/height` or container-fill.

**Events & callbacks:** typed `onDeviceSelect(adapterId)`, `onAlertOpen(alertId)`, `onLoad`, `onError`; no direct `fetch` inside the visual component.

**Backend/API boundary:** component is data-agnostic; API calls remain in existing hooks (`lib/api.ts`, `useApi`, `useAction`). Scene must not mutate backend state.

**Responsive:** container-fill by default; respect `useMediaQuery` breakpoints matching the Shell (`lg:`), pause rendering when unmounted/hidden.

**Loading & error states:** `Suspense` fallback; error boundary; show existing `Empty`/`Skeleton` on failure; never crash the app.

**Performance:** ≤ one `useFrame` per scene, only while visible; `dpr = Math.min(devicePixelRatio, 2)`; dispose geometries/textures; unmount = dispose.

**Accessibility & reduced-motion:** honor `prefers-reduced-motion` (static fallback); `aria-label` on canvas; keyboard fallback interactions; no motion without `allowReducedMotion` opt-out.

**Testing before integration:** TypeScript `tsc -b`, ESLint, visual review on desktop + mid-range Android emulation, WebGL-unavailable fallback check, bundle-size impact (`chunkSizeWarningLimit 700k` in `vite.config.ts:13`).

---

## 8. Five role-specific visualization opportunities

Guidelines applied: no fabricated readings; no home scanning/filming/3D reconstruction; never attribute whole-building consumption to one portable adapter unless measurement supports it; STEG national network distinguished from adapter-level measurements; portable adapter usable in any environment (not only homes).

### Foyer — personal energy universe
1. Real data: own installations' live power, today/month kWh, forecast, alerts, savings (`/api/live`, `/api/home`, `/api/ai`, `/api/rewards`).
2. Functional interactions: tap device → highlight corresponding 3D object; apply recommendation → object state changes; challenge progress → object animation.
3. 3D elements: appliance-level energy objects (e.g., a glowing plug/device per installation whose intensity = current watts), consumption flow from meter to devices. All SIM-labelled.
4. Decorative: ambient room background (optional), non-functional ornamentation.
5. Backend additions: none for phase 1 (uses existing computed metrics).
6. Shared: device object component, energy-unit scale, live pulse.
7. Unique: personal home context, own bill estimate, own token balance.

### Étudiant — gamified campus environment
1. Real data: own studio installations, challenges (`veille-zero`, `sous-reference`, `soiree-douce`), tokens, eco-score.
2. Functional: claim challenge → badge/token update; mission progress bar; dorm building context (BAT-SOU-01 campus).
3. 3D elements: campus/isometric building with per-room device states; progression path; achievement shelves.
4. Decorative: campus ambience, non-functional NPCs/other rooms.
5. Backend additions: none (challenges/tokens exist).
6. Shared: token economy, challenge component.
7. Unique: student/campus theme, mission/quest UI, `etudiant`-only challenges.

### Famille — shared energy environment
1. Real data: household aggregates, occupants, multiple installations, family goal, solidarity contributions.
2. Functional: family goal progress, members' devices, shared challenges, token pooling/donation.
3. 3D elements: shared home energy dashboard, per-member device clusters, goal vessel filling up.
4. Decorative: family illustrations, home ambience.
5. Backend additions: none for phase 1; multi-member household UI would need `Profile.household` membership exposure (currently one profile per household in demo).
6. Shared: goal progress, token ledger.
7. Unique: multi-occupant context, family goal, solidarity.

### Entreprise — interactive facilities & equipment
1. Real data: enterprise household, business installations (compresseur, machine_industrielle, serveurs, eclairage_pro), company totals, peak share, sponsored contributions (`/api/company`, `/api/solidarity`).
2. Functional: equipment on/off state, peak-window highlight, solidarity funding progress.
3. 3D elements: facility/isometric workshop with equipment objects, energy flow from meter to production lines.
4. Decorative: factory ambience, non-functional machinery details.
5. Backend additions: multi-site support would require new model (Building per enterprise site) — currently one household = one site.
6. Shared: energy flow, peak share.
7. Unique: `entreprise` route, business appliance categories, dinar contributions.

### STEG — national network visualization (distinct from adapter-level)
1. Real data: regional aggregates (`/api/steg/overview`), buildings (`/api/steg/buildings`), pseudonymized households (`/api/steg/households/<code>`), incidents (`/api/steg/incidents`), peak heatmap (`/api/steg/peak`), live ticker. **National network ≠ adapter-level measurements**: aggregates combine monitored adapters + unmonitored uses + common areas (`m15/aggregates.py`, meter = monitored + untracked + common).
2. Functional: resolve incidents, drill region → building → household, mask regions with <10 households (privacy, already enforced).
3. 3D elements: exaggerated network schematic (not geographically precise), regional nodes sized by load, incident markers, peak heatmap.
4. Decorative: country outline, animated grid lines (non-functional).
5. Backend additions: none for phase 1 (aggregates exist). Real SCADA/AMI integration would be a new data source.
6. Shared: map/region component (could reuse Leaflet), incident list.
7. Unique: aggregation/masking, pseudonymized codes `FY-xxxx`, resolve action, national scope.

**Portable adapter note:** the adapter (`Adapter`/`Installation`) is not bound to a home; it can move between buildings/households (`Installation.start`/`end` periods, `unpair`/`pair`). 3D scenes should treat it as a movable metering object, not a fixed home device.

---

## 9. Performance and technical risks

- **Bundle:** initial chunk `index` ≈ 504 kB JS + 446 kB charts + 91 kB react + 104 kB motion + 112 kB radix (raw, not gzipped). Adding three/R3F/drei adds substantial weight → **must be lazy-loaded per role route**, never in the initial chunk. Exact gzipped size: UNVERIFIED.
- **Code splitting:** Vite `manualChunks` (react, charts, motion, radix) + dynamic imports for `Atlas` and `NetworkMap` (`manifest.json` dynamicImports). 3D scenes should follow the same pattern.
- **Largest dependencies:** charts, motion, radix, react, leaflet, qr-scanner-worker. Fonts (geist woff2) preloaded via manifest assets.
- **Loading:** React Query polling (2.5 s `live`, 30 s `home`, 60 s STEG), `placeholderData: (prev) => prev`, skeletons, offline banner.
- **Mobile:** Android WebView client (`mobile/`); responsive CSS; geolocation used for pairing; WebGL support on mid-range Android generally present but variable — needs fallback.
- **GPU / memory:** no WebGL currently. Adding always-on 3D would raise GPU/memory use; mitigate: render only when route active, unmount/dispose on leave, cap DPR, low-poly models.
- **3D performance:** R3F `useFrame` must stop when scene unmounted or tab hidden; adaptive quality (lower sample count / simpler geometry on low-end); `powerPreference`.
- **Asset loading:** `useProgress` + `useGLTF`, Suspense, compressed GLB, no large textures.
- **Caching:** React Query staleTime/refetch; Django template caching not used; browser cache for static assets via Vercel CDN.
- **Accessibility:** `prefers-reduced-motion` globally honored; canvas needs `aria-label` + keyboard fallback; 3D scenes must not be the sole means of conveying data.
- **Security:** adding 3D libs increases supply-chain surface; CDN use avoided (the prototype uses cdnjs — **do not replicate**; bundle from npm). No secrets in frontend (CSRF cookie only). Leaflet OSM tiles send referer (noted in `atlas.ts:36-38`).
- **Multiple simultaneous scenes:** avoid; unmount previous scene before mounting next; one canvas at a time.

**Recommendations to stay fast:** lazy load 3D by route; reduced-motion → 2D fallback; render only when visible; cap DPR ≤ 2; low-poly GLB; compress textures; show skeleton while models load; test on mid-range Android; monitor `index` chunk growth against `chunkSizeWarningLimit: 700` kB.

---

## 10. Implementation readiness

### A. Frontend-only with existing APIs (can start now)
- Role-scoped 3D scenes visualizing `/api/live`, `/api/home`, `/api/rewards`, `/api/ai`, `/api/history` metrics (already computed).
- Reusable R3F scene wrapper + reduced-motion fallback.
- Foyer device objects, Étudiant progression, Famille goal, Entreprise facility flow, STEG regional nodes — all from existing computed endpoints.

### B. New backend endpoints needed
- None required for phase 1 (all metrics exist). Future: multi-site enterprise (Building per site), multi-member household membership API, real hardware onboarding beyond `/api/mesures`, SCADA/AMI ingestion for STEG (would be new endpoints/models).

### C. Database model changes / migrations
- None for phase 1. Multi-site/multi-member would require new models/migrations (`m12`).

### D. Additional real data sources
- Real adapter telemetry beyond simulated (hardware posting `/api/mesures`), weather (for heating/cooling loads), real STEG network/AMI data, geocoding beyond bundled OSM extracts. All optional; current data is SIM-labelled.

### E. Technically possible but postpone
- Spline embeds, Lottie, WebGPU, shaders, 3D reconstruction of homes, room scanning, filming (explicitly out of scope per rules), real-time WebSocket/SSE from Django (SSE exists only on the Node simulator `:8787`, not Django).

### Technical debt that could obstruct work
1. **Two parallel model sets** (`m12` for React API vs `m2` for `/m5/` back office): any STEG/back-office 3D must pick one; `m5` back-office views (`m5/views.py`) read `m2.models`, not the React API's `m12`. Risk of divergent data.
2. All energy is simulated; real `Reading` ingestion works but no hardware or dashboard source of truth marks which adapters are real vs simulated at the UI level beyond `source` field.
3. No frontend tests; adding 3D without test coverage raises regression risk.
4. Frontend `tsconfig.app.json` and strictness: new 3D deps need TS types (`@types/three` if used directly; R3F ships types).
5. `vite.config.ts` `chunkSizeWarningLimit: 700` kB — a three-heavy initial chunk would break the build warning threshold.

---

## 11. Prioritized recommendations

1. **Add `three` + `@react-three/fiber` + `@react-three/drei`** to `frontend/package.json`; do NOT use CDN or Spline for data-driven features.
2. **Build one shared `<MierukaScene>` wrapper** (camera, lights, DPR cap, dispose-on-unmount, reduced-motion guard) in `frontend/src/lib/energy/` or `components/scene/`.
3. **Lazy-load 3D scenes by role route** in `frontend/src/App.tsx` (`React.lazy` + `Suspense`), keeping the initial `index` chunk unchanged.
4. **Phase 1: visualize existing computed metrics only** (live power, kWh, forecast, score, tokens, alerts, STEG aggregates) — no new endpoints, no fabricated data, always label `simulee`.
5. **Role-specific scenes:** Foyer (device objects), Étudiant (campus/progression), Famille (goal vessel), Entreprise (facility flow), STEG (regional network, distinct from adapter-level).
6. **Keep maps in Leaflet** (already integrated); do not replace with 3D globes.
7. **Add frontend tests** (vitest + testing-library) before shipping 3D components; set up bundle-size budget.
8. **Resolve the `m12` vs `m2` model divergence** before building STEG/back-office 3D that reads from both.

---

## 12. Exact file references for important findings

**Configuration / manifests**
- `pyproject.toml` — Django 5.2, Vercel build script, entrypoint.
- `uv.lock:262-263` — Django 5.2.19 locked.
- `frontend/package.json` — React 19.1.0, Vite 6.3.5, Tailwind 4.3.5, motion 12.43.0, recharts 2.15.4, leaflet 1.9.4, radix UI, tanstack-query, sonner, lucide-react, qr-scanner, qrcode, Geist fonts. No 3D libs.
- `frontend/vite.config.ts:12-15` — build output `assets/app/`, base `/static/app/`, manualChunks, `/api` proxy.

**Backend**
- `config/urls.py:1-22` — URL dispatch.
- `config/api_urls.py:11-58` — all JSON API routes by module.
- `config/settings.py:127-191` — DB (Turso/SQLite), `SESSION_COOKIE_AGE`, `MIERUKA_*` settings.
- `config/db_backends/turso` — custom Turso backend.
- `kizuna/apiutils.py` — `@api`, `profile_of`, `household_of`, `require_steg`, `ensure_seeded`.
- `kizuna/views.py:spa` — SPA serving; `module_page`.
- `kizuna/api.py:22-161` — auth/me, login, demo, register, profile, benchmark, learn.
- `kizuna/benchmarks.py` — Tunisia/Japan static benchmarks with sources.

**Data model**
- `m12/models.py:18-252` — Region, Building, Household, Profile, Adapter, Installation, Reading, Alert, SavingAction, TokenTx, ChallengeEntry, SolidarityProject, Contribution, LearningProgress, SimState.
- `m2/models.py:14-159` — parallel back-office model (Utilisateur, Adaptateur, Mesure, Alerte, Recompense) used only by `/m5/`.
- `m11/profiles.py:27-87` — CATALOG appliance model; `USER_CATEGORIES`.
- `m11/model.py:1-347` — Spec, power, day_hourly, baseline, forecast, habits, recommendations, unmonitored/common/solar.
- `m12/data.py` — matrix, totals, live_power, installations.
- `m13/engine.py` — anomaly scan rules, forecast, habits, recommendations.
- `m14/rewards.py` — tokens (500/kWh, cap 400), eco_score, challenges, apply_code.
- `m14/tariff.py` — STEG bill estimate (source-labelled).
- `m14/services.py` — home, live, devices, flows, solidarity, company.
- `m15/aggregates.py` — STEG overview/buildings/peak/incidents/regions; privacy masking MIN_HOUSEHOLDS=10.
- `m11/atlas.py` — national atlas (~1000 sim adapters), locate, roof, demo_adapter.
- `m11/models.py` — AtlasLocation (phone GPS fixes).
- `m11/seed.py` — DEMO_ACCOUNTS, LIVE, reset_demo, seed data.
- `m10/adapters.py`, `mekeru/adapters.py` — allauth, staff→steg, profile creation on social login.
- `m1/simulator/server.mjs` — Node headless simulator (port 8787, posts to `/mesures`).

**Frontend**
- `frontend/src/main.tsx`, `frontend/src/App.tsx:49-78` — entry + routes.
- `frontend/src/components/Shell.tsx:21-45` — role-based navigation.
- `frontend/src/lib/session.ts:20` — homeFor; `useSwitch` demo role switching.
- `frontend/src/lib/api.ts:19-34` — fetch client, CSRF, React Query.
- `frontend/src/components/charts.tsx` — LiveArea, Bars, Lines, Donut, Spark, Ring, Legend.
- `frontend/src/components/NetworkMap.tsx` — Leaflet map.
- `frontend/src/lib/atlas.ts:36-39` — OSM tiles, referrer note.
- Pages: `Home.tsx`, `Steg.tsx`, `Company.tsx`, `Atlas.tsx`, `Devices.tsx`, `Rewards.tsx`, `Insights.tsx`, `Explore.tsx`, `Login.tsx`, `Landing.tsx`.
- `frontend/src/components/ui.tsx` — Radix-based design primitives.
- `frontend/src/index.css:7-69` — oklch tokens, dark mode, reduced-motion.
- `assets/3d/prototype.html` — standalone Three.js r128 prototype (NOT integrated).
- `assets/app/.vite/manifest.json` — chunk map; raw sizes listed in §9 (index 504,156 B; charts 445,917 B; etc.; gzipped UNVERIFIED).
- `assets/atlas/*.json` — 9 OSM neighbourhood extracts.
- `templates/kizuna/spa.html`, `templates/kizuna/module.html`, `kizuna-loader.html`.

**Status markers used in this report:** SIM = simulated by m11 model; REAL = stored Reading rows; DERIVED = computed; STATIC = seeded reference; UI-ONLY = visual only. Anything not directly read from source is marked UNVERIFIED.

---

## 13. Conclusion

The platform is technically sound for evolving into five role-specific experiences: the Django API + React SPA already compute all the energy, alert, reward, and STEG aggregate metrics needed, and role gating is implemented. The gap is purely in the presentation layer: **no 3D capability exists in the front end**, and the one Three.js artifact (`assets/3d/prototype.html`) is a standalone, unintegrated prototype. Recommended path: adopt React Three Fiber + Drei, lazy-load scenes by role, visualize only existing computed (simulation-labelled) metrics, keep Leaflet for maps, and add frontend testing + a bundle budget before building the five immersive experiences.

End of report.