# Module 10 — User management

**Owner:** to assign · **Django app:** `m10` · **Branch:** `m10`
**Dependencies:** M2 (`utilisateurs` table) · **Used by:** M4 (household screens), M5 (back office access)
**Plan:** Sprint 1 — choose Clerk or FastAPI and sign in with Google · Sprint 2 — link accounts to households, staff role for the back office · Sprint 3 — profile editing, account deletion

## Features

- Sign in with Google. Two options are still open:
  - **Clerk:** hosted sign-in with Google, Django verifies Clerk's session token.
  - **FastAPI:** our own Google OAuth service that issues tokens Django trusts.
- One login account per household: `Utilisateur.compte` (M2) links the account to its household profile.
- Roles: household (M4 screens) and staff (M5 back office).

## Data and rules

| Rule | Requirement |
|---|---|
| Accounts | A Google account maps to one Django user, linked to one household. |
| Staff | Only staff accounts open the M5 back office. |
| Privacy | A household only ever sees its own data. |
| Deletion | Deleting an account unlinks the household; anonymous aggregates stay. |
| Secrets | Client IDs and secrets live in environment variables, never in the repo. |

## Pages

`app_name = "m10"`:

| URL | Purpose |
|---|---|
| `/m10/` | Placeholder (sign-in comes here) |

## Stories

| ID | Outcome | Priority |
|---|---|---|
| 10.1 | A user signs in with Google | Must |
| 10.2 | A signed-in user is linked to their household | Must |
| 10.3 | Staff accounts reach the back office; others cannot | Must |

## Screenshot

![M10 placeholder](screenshots/placeholder.png)
