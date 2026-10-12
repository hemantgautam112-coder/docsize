import { Link } from "react-router-dom";
import { STRINGS } from "../strings.js";

/*
 * DRAFT. Prepared without legal review. It must be checked by a qualified lawyer before
 * HDVault is offered to the public.
 */
export default function Terms() {
  return (
    <article className="card space-y-5 text-slate-700">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Terms of Use</h1>
        <p className="text-sm text-slate-500">Last updated: {STRINGS.policyDate}. Draft, to be reviewed.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">1. About HDVault</h2>
        <p>
          HDVault is an independent tool. It is not an official government website and is not affiliated with any government
          body or exam conducting authority.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">2. Who can use it</h2>
        <p>You must be at least 18 years old, or use HDVault with a parent or guardian, to create an account.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">3. Your responsibility</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Check that each processed file meets the official requirements of the exam or portal before you submit it. Verify against the official notification.</li>
          <li>Exam values shown in HDVault may be placeholders or may change. Do not rely on them without checking the notification.</li>
          <li>Upload only your own photo, signature, or 10th or 12th marksheet, as described in the Privacy Policy. Do not upload identity documents or numbers.</li>
          <li>Keep your own copies of anything important. Your originals are stored unchanged, but you are responsible for your records.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">4. No guarantee</h2>
        <p>
          HDVault does its best to produce files within the size and format you choose. It does not guarantee that a portal,
          exam body, or official will accept any file.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">5. Acceptable use</h2>
        <p>
          Do not use HDVault to upload anything unlawful, to try to access other people's files, to disrupt the service, or to
          forge or misrepresent documents.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">6. Account and deletion</h2>
        <p>
          You can delete your account at any time from the Vault page. Deleting it removes your files, processed copies, and
          records. We may suspend or delete accounts that misuse HDVault.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">7. Service changes and availability</h2>
        <p>
          We may change, pause, or stop parts of HDVault. We do not promise the service will always be available.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">8. Liability</h2>
        <p>
          HDVault is provided as it is. To the extent permitted by law, we are not liable for losses from missed deadlines,
          rejected applications, lost files, or from relying on information shown in HDVault.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">9. Governing law</h2>
        <p>These terms are governed by the laws of India.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">10. Contact</h2>
        <p>
          Questions about these terms: <a className="underline" href={`mailto:${STRINGS.supportEmail}`}>{STRINGS.supportEmail}</a>
        </p>
        <p className="text-sm text-slate-500">
          See also our <Link className="underline" to="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </article>
  );
}
