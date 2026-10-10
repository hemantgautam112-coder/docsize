# HDVault

HDVault helps Indian government exam aspirants resize and convert their photos, signatures, thumb impressions, and marksheets to the limits set by each application portal. Upload each original once, then download copies compressed to a target size, such as a photo under 20 KB.

**HDVault is an independent tool.** It is not an official government website and is not affiliated with any government body or exam conducting authority. Always verify requirements against the official notification before you upload.

**Do not upload Aadhaar cards or other identity numbers.** Upload only the files a portal asks for.

## Features

- **Sign up and log in** with a one-time code sent to a mobile number or email, or with Google sign-in. Sign-up requires consent to the privacy policy.
- **Document vault:** upload JPG, PNG, or PDF files up to 10 MB. Each file's type is checked from its content, not its extension. Originals are stored unchanged and checked against a SHA-256 hash on every read.
- **Processing:**
  - Photos and signatures: EXIF orientation is applied, transparency is flattened to white, metadata is removed, and the image is cropped and resized. JPEG quality is searched to fit the size limit, and the image is shrunk only as far as it stays readable.
  - PDFs: lossless cleanup first, then embedded images are downsampled and recompressed.
  - Every run returns a report with the actual size, quality, dimensions, whether the target was met, and any warnings.
- **Two modes:** choose a standard exam profile, or enter a custom target size from 5 to 2000 KB, with optional dimensions in pixels or centimetres.
- **History:** re-download, preview, or delete any processed copy. Copies expire after 30 days.
- **Privacy:** every file is served only to its owner, users can delete their account and all their files, and logs contain no file contents or personal data.

## Project structure

```
Adhoc_Project/
├── CLAUDE.md              project specification
├── README.md              this file
├── .gitignore
├── backend/               FastAPI API (Python)
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── app/
│   │   ├── main.py        app, middleware, routes
│   │   ├── config.py      settings from environment variables
│   │   ├── models.py      database tables
│   │   ├── schemas.py     request and response models
│   │   ├── security.py    session cookie and CSRF
│   │   ├── api/           auth, documents, derived files, profiles
│   │   └── services/      storage, OTP, Google sign-in, processing engines
│   └── tests/             pytest suites
└── frontend/              React + Vite + Tailwind CSS
    ├── README.md          frontend setup and routes
    └── src/               pages, API client, components, tests
```

## Requirements

- Windows, macOS, or Linux
- Python 3.11 or newer
- Node.js 20 or newer
- Git (to clone and push the repository)

## Setup

Run these from the project root.

**1. Create the Python environment and install the backend packages**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

**2. Install the frontend packages**

```powershell
cd frontend
npm install
cd ..
```

**3. Create the configuration files (optional for basic testing)**

The backend reads a `.env` file in the project root. Every setting is optional for local testing. The table below lists the settings you're most likely to use.

| Variable | Purpose | Default |
| --- | --- | --- |
| `SECRET_KEY` | Signs OTP hashes and session tokens. Must be at least 32 characters. Required in production. | Random on each start (dev only) |
| `ADMIN_EMAILS` | Comma-separated emails that become admins on login. Admins can create exam profiles. | empty |
| `FRONTEND_ORIGIN` | Browser origin allowed by CORS. | `http://localhost:5173` |
| `DATABASE_URL` | Database connection. SQLite for development, PostgreSQL later. | `storage/docsize.db` |
| `STORAGE_DIR` | Folder where uploaded and processed files are stored. | `storage` |
| `DERIVED_RETENTION_DAYS` | Days before processed copies expire. | `30` |
| `MAX_UPLOAD_MB` | Maximum upload size. | `10` |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in when set. | empty (disabled) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` | Send email login codes through an SMTP server. Leave `SMTP_HOST` empty to print codes to the backend console instead. | empty |
| `SMTP_USE_TLS` | Set to `false` for local test servers such as Mailpit. | `true` |
| `COOKIE_SECURE` | Send session cookies over HTTPS only. Required in production. | `false` |
| `APP_ENV` | `development`, `test`, or `production`. | `development` |

For Google sign-in, also create `frontend/.env.local`:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Never commit `.env` or `.env.local`.** They are listed in `.gitignore`, and they can hold passwords.

## Running the app

Open two terminals.

**Terminal 1: backend**

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

API documentation: http://127.0.0.1:8000/docs

**Terminal 2: frontend**

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

The frontend sends API requests through a development proxy to the backend on port 8000. Because of this, the browser only talks to port 5173.

**One-time codes:** with no SMTP settings, login codes for mobile numbers and emails print in the backend terminal. With SMTP settings, email codes are sent to the inbox, and mobile codes still print in the terminal.

**Phone on the same Wi-Fi:** run `npm run dev -- --host` in the frontend folder, then open `http://<your-PC-IP>:5173` on the phone.

## Testing

```powershell
# Backend: 52 tests (about 30 seconds)
cd backend
python -m pytest

# Frontend: 14 tests
cd frontend
npm test

# Frontend production build
npm run build
```

Backend tests use a temporary database and storage folder, so they never touch your development data.

## Trying it out

1. Open http://localhost:5173 and go to **Sign up**. Enter your mobile number or email, tick the consent box, and enter the code.
2. In **Vault**, upload a photo, a signature, or a marksheet.
3. In **Process**, choose the file, then either an exam profile or a custom size in KB. Check the preview and the actual size, then download.
4. In **History**, re-download or delete any processed copy.

Exam profiles are not seeded yet. To add them, sign in with an email listed in `ADMIN_EMAILS`, then call `POST /profiles` in the API docs.

## Current limitations

- **Exam profiles are placeholders.** The app does not yet ship with verified exam requirements. Check every value against the official notification.
- **SMS delivery is not built.** Mobile-number codes print in the backend terminal. Sending SMS needs a paid or DLT-registered provider.
- **Rate limits are in memory,** so they reset when the backend restarts and don't work across multiple servers.
- **Logout does not revoke the session token,** which stays valid until it expires (7 days by default). Logout clears the cookie.
- **Login reveals whether an account exists,** because the messages differ for "log in" and "sign up". This is a deliberate trade-off for clearer errors.
- **Google sign-in** is a third-party cloud service, which goes against the spec's free-and-open-source constraint. Sign-in needs HTTPS or `localhost`.
- **Not yet built:** the virus-scan hook, the seed and cleanup scripts, Docker Compose setup, Alembic migrations, and Hindi or other translations. Expired processed copies are removed by a service function, but no scheduled job runs it yet.

## Moving to paid or hosted services

When you deploy, replace the local pieces with managed services:

- **File storage:** an S3-compatible bucket, by adding an adapter behind `StorageProvider`.
- **Mobile OTP:** an SMS provider such as MSG91 or Twilio, behind `OtpProvider`. Register the sender with DLT in India.
- **Database:** managed PostgreSQL, set through `DATABASE_URL`. Then use Alembic for schema changes.
- **HTTPS hosting:** set `COOKIE_SECURE=true` and `APP_ENV=production`, and put the app behind HTTPS.
- **Monitoring and backups** for the database and file storage.

## License

Add a license before you publish the repository publicly.
