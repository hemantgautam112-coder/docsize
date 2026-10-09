# DocSize frontend

React + Vite + Tailwind CSS. It talks to the FastAPI backend in `../backend`.

DocSize is an independent tool. It is not an official government website and is not affiliated with any government body or exam conducting authority.

## Requirements

- Node.js 20 or newer (tested with Node 24)
- The backend running on http://127.0.0.1:8000 (see `../README.md` or `backend/`)

## Install

```powershell
cd C:\Users\hegautam\Documents\Adhoc_Project\frontend
npm install
```

## Run the development server

Start the backend first, in its own terminal:

```powershell
cd C:\Users\hegautam\Documents\Adhoc_Project\backend
python -m uvicorn app.main:app --reload --port 8000
```

Then start the frontend:

```powershell
cd C:\Users\hegautam\Documents\Adhoc_Project\frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Where the backend address is set

Edit `src/config.js`:

- `BACKEND_URL` is the FastAPI server, `http://127.0.0.1:8000`. In development, Vite forwards every `/api/...` request to it. The browser only talks to `localhost:5173`, so the session cookie works. Calling `127.0.0.1:8000` directly from a `localhost` page would fail, because the browser treats them as different sites.
- `API_BASE_URL` is `/api` by default. For a deployed build, set `VITE_API_BASE_URL` to the full API origin, for example `VITE_API_BASE_URL=https://api.example.com npm run build`. The backend's `FRONTEND_ORIGIN` must then match the frontend's address.

## Other scripts

```powershell
npm test          # run the unit and smoke tests (Vitest + Testing Library)
npm run build     # production build into dist/
npm run preview   # serve dist/ locally
```

## Backend routes the frontend uses

Check these in http://127.0.0.1:8000/docs:

| Page | Route |
| --- | --- |
| Every page | `GET /auth/csrf`, `GET /auth/me` |
| Login | `POST /auth/request-otp`, `POST /auth/verify-otp` |
| Logout | `POST /auth/logout` |
| Account deletion (Vault) | `DELETE /auth/account` |
| Vault | `GET /documents`, `POST /documents`, `GET /documents/{id}/file`, `DELETE /documents/{id}` |
| Process | `GET /profiles?document_type=...`, `POST /documents/{id}/process`, `GET /derived/{id}/file` |
| History | `GET /derived`, `GET /derived/{id}/file`, `DELETE /derived/{id}`, plus `GET /documents` for file names |

Every mutating request sends the `X-CSRF-Token` header, which the client takes from `GET /auth/csrf`.

## Project layout

```
src/
  config.js           backend address (one place)
  api/client.js       fetch wrapper: CSRF header, cookies, error messages
  api/endpoints.js    one function per backend route
  context/            signed-in user state
  components/         layout, footer disclaimer, alerts, progress, confirm buttons
  pages/              Login, Vault, Process, History, Privacy, Terms
  lib/                formatting, validation, file download helpers
  strings.js          user-facing text, kept together for future translations
  test/               Vitest smoke tests
```

## Notes

- Originals are never modified. The Process page only creates new files.
- The Process page shows the processed file's actual size, the target, a preview, and any warnings. If the target cannot be reached, it says so and suggests what to change.
- Exam profiles marked as placeholders show a warning. Check every value against the official notification.
- Upload size and file type are checked in the browser for a quick message. The backend's checks are the real ones.
- Strings live in `src/strings.js` and the page files. Moving them to a translation library is a later step.
