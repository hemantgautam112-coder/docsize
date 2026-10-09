# DocSize: Project Specification

You are a senior full-stack engineer. Build a complete, working, end-to-end web application called "DocSize" (the name can be changed). Deliver all code, not snippets.

## Purpose
Indian government exam aspirants must upload photos, signatures, thumb impressions, and marksheets to application portals. Each portal has different file size and format limits, and students repeatedly resize files by hand. DocSize lets a user upload original documents once, then download derived copies compressed or converted to a target size (for example, a photo under 20 KB). Original files must never be modified. Users can come back and download any derived version later.

## Scope and Constraints
- This phase uses only free and open-source tools. No paid APIs or cloud services.
- It must run fully on a local machine with a single command (Docker Compose preferred, plain local commands acceptable).
- Design for later migration to paid services (cloud object storage, SMS OTP provider, managed PostgreSQL, hosted deployment). Put every external dependency behind an interface or adapter, configured by environment variables. For example: StorageProvider (LocalStorage now, S3 later), OtpProvider (ConsoleOtpProvider now, SMS provider later).
- Do not invent official government specifications. Exam profiles are seeded with clearly marked placeholder values that must be verified (see Exam Profiles below).

## Suggested Stack (use unless you have a strong reason to change it, and explain why)
- Backend: Python 3.11+, FastAPI, SQLAlchemy, Pydantic, Alembic or create_all for migrations. Use SQLite for development through DATABASE_URL, keeping the code compatible with PostgreSQL.
- Image processing: Pillow. PDF processing: pypdf and/or pikepdf, with Ghostscript used optionally if installed.
- Frontend: React with Vite and Tailwind CSS, mobile-first and responsive. Use plain fetch or a small API client.
- Auth: JWT stored in an httpOnly, SameSite cookie, with CSRF protection.
- Testing: pytest for backend logic, and at least basic frontend smoke tests.

## Core Features

### 1. Authentication
- Sign up and log in with mobile number or email, using a one-time password (OTP).
- OTP is hashed in the database, expires after 5 minutes, allows 3 attempts, and is rate limited.
- In development, the OTP is printed to the server console through ConsoleOtpProvider.
- Require a consent checkbox at sign-up that links to the privacy page.

### 2. Document Vault
- Upload originals: JPG, PNG, or PDF, with a 10 MB maximum per file.
- Validate file type by reading magic bytes, not by trusting the file extension.
- Document types: photo, signature, thumb, marksheet_10, marksheet_12, graduation, other.
- Store originals under random UUID filenames, never overwrite them, and save a SHA-256 hash at upload so immutability can be verified.
- Show each original's size, dimensions (for images), and page count (for PDFs).

### 3. Exam Profiles (standard exams)
- Create an ExamProfile table with: exam_name, post (optional), document_type, max_kb, min_kb (optional), output_format, width_px and height_px (optional), dpi (optional), background (default "white"), notes, source_url, last_verified_on, is_placeholder (boolean).
- Seed data/exam_profiles.json with placeholder entries for: SSC CGL, SSC CHSL, SSC MTS, SSC GD, IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, RRB NTPC, RRB Group D, RRB JE. Use plausible placeholder values, mark every entry is_placeholder=true, and clearly flag them in the UI with a message to verify against the official notification before use.
- Provide a seed script and an admin-only endpoint or CLI to update profiles.

### 4. Processing Engine
Image processing (photo and signature):
- Fix EXIF orientation, convert to RGB, flatten transparency onto a white background, and strip all metadata.
- If width/height are given, crop to the aspect ratio if needed, then resize. Never upscale beyond a reasonable factor, and warn if it does.
- Binary-search JPEG quality (and, if still too large, progressively downscale) to get the largest output that is at or below max_kb, and ideally at least 90% of it. Never exceed max_kb.
- Enforce a minimum readable size and warn when the target cannot be reached without making the image unreadable.

PDF processing:
- First try lossless optimization. If still too large, downsample and recompress embedded images, iterating over DPI and quality.
- If the target cannot be met, return the best achieved result with a clear warning.

Every processing run returns a report: final_size_kb, quality setting, dimensions or DPI, target_met (boolean), and a list of warnings.

### 5. Two Modes
- Exam mode: user selects a standard exam profile, which pre-fills the target size, format, and background. The user can override any value.
- Custom mode: user enters a target size in KB (allowed range 5 to 2000), and optionally width, height, unit (px or cm, with DPI when cm), and output format. Background defaults to white.

### 6. Preview, Download, and History
- After processing, show a preview, the actual output size, and the report. The user then chooses to download.
- Save each derived file as a DerivedFile row linked to its original and the parameters used.
- Download sets a sensible filename, for example "photo_SSC_CGL_20KB.jpg".
- Show a history list of derived files. The user can re-download any of them, delete them, or delete originals.

### 7. Privacy and Security
- Files are served only to their owner. Every file route checks authorization. Do not expose a public static directory.
- Users can delete their account, which removes all files and records.
- Derived files auto-delete after a configurable number of days (default 30) through a cleanup script or scheduled task.
- No file contents or personal data in logs.
- Show a warning in the UI not to upload Aadhaar or other sensitive identity numbers.
- Validate all inputs. Enforce upload and request size limits, rate limit upload and processing endpoints, restrict CORS to the frontend origin, and set secure HTTP headers.
- Secrets come from a .env file. Provide .env.example.
- Include a virus-scan hook as a placeholder interface, with no-op as the default implementation.

### 8. Disclaimer and UX
- Footer and landing page state that DocSize is an independent tool, not affiliated with any government body, and that users must verify requirements against the official notification.
- Mobile-first design with large buttons, a clear progress indicator during processing, and plain-language error messages.
- Structure UI strings so Hindi and other languages can be added later.

## Data Model (minimum)
User, OtpCode, OriginalDocument, DerivedFile, ExamProfile, plus a ProcessingLog if useful. Include created_at, owner_id, and sha256 where relevant.

## API Endpoints (minimum)
- POST /auth/request-otp, POST /auth/verify-otp, POST /auth/logout, DELETE /auth/account
- GET /profiles, GET /profiles/{id} (public), admin-only POST/PUT for profiles
- POST /documents (upload), GET /documents, GET /documents/{id}, DELETE /documents/{id}
- GET /documents/{id}/file (original, owner only)
- POST /documents/{id}/process (body: profile_id or custom parameters) returns a DerivedFile with report
- GET /derived, GET /derived/{id}/file, DELETE /derived/{id}
- GET /health

## Project Structure
- backend/ (app/, api/, services/ for storage, otp, processing, models/, tests/)
- frontend/ (src/ with pages for login, vault, process, history, privacy, and terms)
- data/exam_profiles.json
- scripts/seed_profiles.py, scripts/cleanup_expired.py
- docker-compose.yml, .env.example, README.md

## Working Order
1. Briefly state the architecture and the assumptions you made.
2. Build the backend: models, storage, OTP, processing engine, then API routes.
3. Write pytest tests for the processing engine (target size respected, originals unchanged by hash, PDF path works, warnings returned when target is unreachable) and for authorization (another user gets 403).
4. Build the frontend.
5. Write docker-compose.yml, .env.example, scripts, and README with exact setup and run steps.

If the output is too long for one reply, stop at a clean file boundary and wait for me to type "continue".

## Acceptance Criteria
- A new user can sign up with an OTP printed in the console, upload a photo, signature, and marksheet, and select "SSC CGL photo" to get a JPEG at or below the target size.
- The preview shows the actual size. Download works, and the file can be re-downloaded from history later.
- The original file's SHA-256 hash is unchanged after processing.
- A second user cannot access the first user's files.
- Custom mode works for both image and PDF input.
- All tests pass.
- The app runs locally with one documented command.

## Final Output
At the end, provide:
- The complete file tree
- Setup and run instructions
- How to test with sample images
- A list of known limitations
- A checklist of what to change when moving to paid services (cloud storage, SMS OTP, managed database, HTTPS hosting, monitoring, backups)