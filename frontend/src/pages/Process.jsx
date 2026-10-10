import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/endpoints.js";
import { Alert, ProgressSteps, Spinner } from "../components/ui.jsx";
import { saveBlob } from "../lib/download.js";
import {
  documentTypeLabel,
  documentSummary,
  formatKB,
  isPdfMime,
  validateTargetKb,
} from "../lib/format.js";
import { STRINGS } from "../strings.js";

const PROCESSING_STEPS = [
  "Reading your file",
  "Fixing orientation and removing hidden data",
  "Adjusting quality to the size limit",
  "Checking the result",
];

const DPI_MIN = 72;
const DPI_MAX = 600;

export default function Process() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("document") ?? "";

  const [documents, setDocuments] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [mode, setMode] = useState("exam");
  const [profiles, setProfiles] = useState([]);
  const [profilesError, setProfilesError] = useState(null);
  const [profileId, setProfileId] = useState("");

  const [targetKb, setTargetKb] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState("px");
  const [dpi, setDpi] = useState("200");

  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null); // { url, blob }

  const doc = documents?.find((item) => item.id === selectedId) ?? null;
  const isPdf = doc ? isPdfMime(doc.mime_type) : false;
  const profile = profiles.find((item) => String(item.id) === profileId) ?? null;
  const outputChoices = isPdf ? ["pdf"] : ["jpeg", "png"];
  const documentTypeValue = doc?.document_type;

  // Load the vault once.
  useEffect(() => {
    api
      .listDocuments()
      .then(setDocuments)
      .catch((err) => setLoadError(err.message));
  }, []);

  // Load the exam profiles that match the chosen document's type.
  useEffect(() => {
    setProfiles([]);
    setProfileId("");
    setProfilesError(null);
    if (!documentTypeValue) return;
    api
      .profiles(documentTypeValue)
      .then(setProfiles)
      .catch((err) => setProfilesError(err.message));
  }, [documentTypeValue]);

  // A different file means any earlier result no longer applies.
  useEffect(() => {
    setResult(null);
    setFormError(null);
    setTargetKb("");
    setOutputFormat("");
    setWidth("");
    setHeight("");
  }, [selectedId]);

  // Build a preview object URL for the processed file, and release it when it changes.
  useEffect(() => {
    if (!result) return undefined;
    let cancelled = false;
    let url;
    api
      .derivedFileBlob(result.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, blob });
      })
      .catch((err) => {
        if (!cancelled) setFormError(err.message);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [result]);

  function chooseFile(id) {
    setSearchParams(id ? { document: id } : {});
  }

  function chooseProfile(id) {
    setProfileId(id);
    const chosen = profiles.find((item) => String(item.id) === id);
    setTargetKb(chosen ? String(chosen.max_kb) : "");
    setOutputFormat(chosen ? chosen.output_format : "");
    setWidth("");
    setHeight("");
  }

  function validate() {
    if (!doc) return "Choose a file to process first.";

    if (mode === "exam") {
      if (!profile) return "Choose an exam profile, or switch to custom size.";
      if (targetKb !== String(profile.max_kb)) {
        const problem = validateTargetKb(targetKb);
        if (problem) return problem;
      }
      if (profile.min_kb && Number(targetKb) < profile.min_kb) {
        return `The target size is below this profile's minimum of ${profile.min_kb} KB.`;
      }
    } else {
      const problem = validateTargetKb(targetKb);
      if (problem) return problem;
    }

    if (!isPdf && (width || height)) {
      if ((width && Number(width) <= 0) || (height && Number(height) <= 0)) {
        return "Width and height must be greater than zero.";
      }
      if (unit === "cm" && (Number(dpi) < DPI_MIN || Number(dpi) > DPI_MAX)) {
        return `DPI must be between ${DPI_MIN} and ${DPI_MAX} when the size is in centimetres.`;
      }
    }
    return null;
  }

  function buildBody() {
    if (mode === "exam") {
      const body = { profile_id: Number(profileId) };
      if (targetKb !== String(profile.max_kb)) body.target_kb = Number(targetKb);
      if (!isPdf && outputFormat && outputFormat !== profile.output_format) body.output_format = outputFormat;
      if (!isPdf && width) body.width = Number(width);
      if (!isPdf && height) body.height = Number(height);
      return body;
    }

    const body = { target_kb: Number(targetKb), output_format: isPdf ? "pdf" : outputFormat || "jpeg" };
    if (!isPdf && (width || height)) {
      if (width) body.width = Number(width);
      if (height) body.height = Number(height);
      body.unit = unit;
      if (unit === "cm") body.dpi = Number(dpi);
    }
    return body;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(await api.processDocument(doc.id, buildBody()));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    try {
      if (preview?.blob) {
        saveBlob(preview.blob, result.download_name);
      } else {
        saveBlob(await api.derivedFileBlob(result.id), result.download_name);
      }
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (loadError) return <Alert>{loadError}</Alert>;
  if (documents === null) return <Spinner label="Loading your files..." />;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Resize for a portal</h1>
        <p className="text-sm text-slate-600">
          Pick a file, choose the exam or enter your own size. HDVault creates a new copy. Your original is not changed.
        </p>
      </section>

      {documents.length === 0 ? (
        <div className="card space-y-3">
          <p className="text-sm text-slate-700">You have no files yet.</p>
          <Link className="btn-primary" to="/vault">Go to the vault and upload a file</Link>
        </div>
      ) : (
        <div className="card space-y-4">
          <div>
            <label className="label" htmlFor="source-file">1. Choose a file</label>
            <select id="source-file" className="input" value={selectedId} onChange={(e) => chooseFile(e.target.value)}>
              <option value="">Select a file...</option>
              {documents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.original_filename} ({documentTypeLabel(item.document_type)})
                </option>
              ))}
            </select>
          </div>
          {doc && (
            <p className="text-sm text-slate-600">
              {documentTypeLabel(doc.document_type)} · {formatKB(doc.size_bytes)}
              {documentSummary(doc) && ` · ${documentSummary(doc)}`}
            </p>
          )}
        </div>
      )}

      {doc && (
        <form className="card space-y-5" onSubmit={handleSubmit} aria-label="Processing options">
          <fieldset className="space-y-3">
            <legend className="label">2. Choose how to set the size</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeButton active={mode === "exam"} onClick={() => setMode("exam")}>Standard exam profile</ModeButton>
              <ModeButton active={mode === "custom"} onClick={() => setMode("custom")}>Custom size</ModeButton>
            </div>
          </fieldset>

          {mode === "exam" && (
            <div className="space-y-3">
              {profilesError && <Alert>{profilesError}</Alert>}
              {!profilesError && profiles.length === 0 && (
                <Alert type="info">
                  No exam profiles exist yet for {documentTypeLabel(doc.document_type)} documents. Use custom size instead.
                </Alert>
              )}
              {profiles.length > 0 && (
                <>
                  <div>
                    <label className="label" htmlFor="profile">Exam</label>
                    <select id="profile" className="input" value={profileId} onChange={(e) => chooseProfile(e.target.value)}>
                      <option value="">Select an exam...</option>
                      {profiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.exam_name}{item.post ? ` · ${item.post}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {profile && <ProfileDetails profile={profile} />}
                </>
              )}
            </div>
          )}

          {(mode === "custom" || profile) && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="target">Target size (KB)</label>
                  <input
                    id="target"
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={2000}
                    value={targetKb}
                    onChange={(e) => setTargetKb(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">Allowed: 5 to 2000 KB.</p>
                </div>
                <div>
                  <label className="label" htmlFor="output">Output format</label>
                  <select
                    id="output"
                    className="input"
                    value={outputFormat || outputChoices[0]}
                    onChange={(e) => setOutputFormat(e.target.value)}
                  >
                    {outputChoices.map((choice) => (
                      <option key={choice} value={choice}>{choice.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!isPdf && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Size in pixels. Leave both blank to keep the photo's shape and size.
                    {mode === "custom" && " Enter both dimensions to crop to an exact size."}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {mode === "custom" && (
                      <div>
                        <label className="label" htmlFor="unit">Unit</label>
                        <select id="unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                          <option value="px">Pixels (px)</option>
                          <option value="cm">Centimetres (cm)</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="label" htmlFor="width">Width ({mode === "custom" ? unit : "px"})</label>
                      <input id="width" className="input" type="number" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="height">Height ({mode === "custom" ? unit : "px"})</label>
                      <input id="height" className="input" type="number" min="0" step="any" value={height} onChange={(e) => setHeight(e.target.value)} />
                    </div>
                  </div>
                  {mode === "custom" && unit === "cm" && (
                    <div className="max-w-xs">
                      <label className="label" htmlFor="dpi">DPI</label>
                      <input id="dpi" className="input" type="number" min={DPI_MIN} max={DPI_MAX} value={dpi} onChange={(e) => setDpi(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {isPdf && (
                <Alert type="info">PDF files keep their page layout. Only the file size is reduced. Width and height do not apply.</Alert>
              )}

              {targetKb && Number(targetKb) < 15 && !isPdf && (
                <Alert type="warning">
                  Targets under 15 KB often make photos or signatures hard to read. If the result is too blurry, raise the target or check the portal's rules.
                </Alert>
              )}
            </div>
          )}

          {formError && <Alert>{formError}</Alert>}

          {(mode === "custom" || profile) && (
            <div className="space-y-3">
              {busy ? (
                <ProgressSteps steps={PROCESSING_STEPS} />
              ) : (
                <button type="submit" className="btn-primary">Create resized copy</button>
              )}
              {busy && <p className="text-xs text-slate-500">{STRINGS.slowWarning}</p>}
            </div>
          )}
        </form>
      )}

      {result && <ResultPanel result={result} preview={preview} isPdf={isPdf} onDownload={handleDownload} />}
    </div>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`btn ${active ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

function ProfileDetails({ profile }) {
  const dimensions = profile.width_px && profile.height_px ? `${profile.width_px} × ${profile.height_px} px` : "Not fixed";
  return (
    <div className="space-y-3">
      {profile.is_placeholder && <Alert type="warning">{STRINGS.placeholderWarning}</Alert>}
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Maximum</dt>
          <dd className="font-semibold">{profile.max_kb} KB</dd>
        </div>
        <div>
          <dt className="text-slate-500">Minimum</dt>
          <dd className="font-semibold">{profile.min_kb ? `${profile.min_kb} KB` : "Not set"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Format</dt>
          <dd className="font-semibold">{profile.output_format.toUpperCase()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Dimensions</dt>
          <dd className="font-semibold">{dimensions}</dd>
        </div>
      </dl>
      {profile.notes && <p className="text-xs text-slate-500">{profile.notes}</p>}
    </div>
  );
}

function ResultPanel({ result, preview, isPdf, onDownload }) {
  const report = result.report;
  const actualKb = result.size_bytes / 1024;
  const percent = Math.min(100, Math.round((actualKb / report.target_kb) * 100));

  return (
    <section className="card space-y-5" aria-label="Processed result">
      <div>
        <h2 className="text-lg font-semibold">Preview</h2>
        <p className="text-sm text-slate-600">Check the preview before you download.</p>
      </div>

      <div className="rounded-xl bg-slate-100 p-3">
        {!preview && <Spinner label="Loading preview..." />}
        {preview && !isPdf && (
          <img src={preview.url} alt="Preview of your resized copy" className="mx-auto max-h-[60vh] max-w-full rounded-md bg-white object-contain" />
        )}
        {preview && isPdf && (
          <iframe title="Preview of your resized PDF" src={preview.url} className="h-[60vh] w-full rounded-md bg-white" />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Actual size</dt>
          <dd className="text-xl font-bold text-slate-900">{formatKB(result.size_bytes)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Target</dt>
          <dd className="text-xl font-bold text-slate-900">{report.target_kb} KB</dd>
        </div>
        <div>
          <dt className="text-slate-500">Output</dt>
          <dd className="font-semibold">{result.output_format.toUpperCase()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{isPdf ? "Pages" : "Dimensions"}</dt>
          <dd className="font-semibold">
            {isPdf ? report.page_count : `${report.width_px} × ${report.height_px} px`}
          </dd>
        </div>
      </dl>

      <div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className={`h-full rounded-full ${result.target_met ? "bg-emerald-600" : "bg-red-600"}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{percent}% of the target size</p>
      </div>

      {!result.target_met && (
        <Alert>
          The target of {report.target_kb} KB could not be reached. The smallest version is{" "}
          {formatKB(result.size_bytes)}. The {isPdf ? "document" : "photo"} may be too detailed for this limit without becoming unreadable.
          Try a larger target size, a sharper or simpler {isPdf ? "scan" : "image"}, or check the portal's requirement before you upload.
        </Alert>
      )}

      {report.warnings.map((warning) => (
        <Alert key={warning} type="warning">{warning}</Alert>
      ))}
      {report.notes.map((note) => (
        <Alert key={note} type="info">{note}</Alert>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn-primary" onClick={onDownload} disabled={!preview}>
          Download {result.download_name}
        </button>
        <Link className="btn-secondary" to="/history">See all processed copies</Link>
      </div>
      <p className="text-xs text-slate-500">{STRINGS.derivedRetention}</p>
    </section>
  );
}
