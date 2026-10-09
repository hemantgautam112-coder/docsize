import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <article className="card prose-sm space-y-4 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Privacy</h1>
      <p>
        DocSize is an independent tool and is not affiliated with any government body. This page describes how your data is handled.
      </p>
      <h2 className="text-lg font-semibold text-slate-900">What we store</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your mobile number or email, used to log in, and the time you accepted this policy.</li>
        <li>The files you upload, stored unchanged, and the copies DocSize creates from them.</li>
        <li>A short audit log of actions such as upload, process, download, and delete. It holds no file contents.</li>
      </ul>
      <h2 className="text-lg font-semibold text-slate-900">Who can see your files</h2>
      <p>Only your signed-in account can see or download your files.</p>
      <h2 className="text-lg font-semibold text-slate-900">How long we keep files</h2>
      <p>Processed copies are deleted automatically after 30 days. You can delete any file, or your whole account, at any time from the Vault page.</p>
      <h2 className="text-lg font-semibold text-slate-900">Do not upload identity numbers</h2>
      <p>Do not upload Aadhaar cards or other identity numbers. Upload only what an exam portal asks for.</p>
      <p>
        Questions about this page? Read our <Link className="underline" to="/terms">Terms</Link>.
      </p>
    </article>
  );
}
