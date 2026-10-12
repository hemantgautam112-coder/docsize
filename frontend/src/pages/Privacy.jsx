import { Link } from "react-router-dom";
import { STRINGS } from "../strings.js";

/*
 * DRAFT. Prepared without legal review. It must be checked by a qualified lawyer before
 * HDVault is offered to the public. It is written to be honest about how the current version works.
 */
export default function Privacy() {
  return (
    <article className="card space-y-5 text-slate-700">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="text-sm text-slate-500">Last updated: {STRINGS.policyDate}. Draft, to be reviewed.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">1. Who we are</h2>
        <p>
          HDVault is an independent online tool that helps you resize and convert photos, signatures, and documents to the
          limits set by exam application portals. HDVault is not an official government website and is not affiliated with
          any government body or exam conducting authority.
        </p>
        <p>
          For any privacy question or request, write to <a className="underline" href={`mailto:${STRINGS.supportEmail}`}>{STRINGS.supportEmail}</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">2. What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium">Login details:</span> your email address. If you sign in with Google, we receive your verified email address and Google's account ID. We do not receive your Google password.</li>
          <li><span className="font-medium">Consent record:</span> the date and time you agreed to this policy.</li>
          <li><span className="font-medium">Files you upload:</span> the file itself, its name, size, dimensions or page count, and the tag you give it (for example, photo or signature).</li>
          <li><span className="font-medium">Processed copies:</span> the resized or converted files we create for you, and the settings you chose.</li>
          <li><span className="font-medium">Activity log:</span> a record of actions such as upload, process, download, and delete. It does not contain file contents.</li>
          <li><span className="font-medium">Technical data:</span> server logs, which can include your IP address and the pages you request. We use one essential cookie to keep you logged in, and one cookie to protect against forged requests. We do not use advertising or tracking cookies.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">3. Why we use it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To create and secure your account and send you login codes.</li>
          <li>To process your files and show you your history of uploads and copies.</li>
          <li>To keep the service secure, detect misuse, and fix problems.</li>
          <li>To meet legal obligations, if any apply.</li>
        </ul>
        <p>We do not sell your data, and we do not use it for advertising.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">4. Consent</h2>
        <p>
          You give consent when you sign up by ticking the box. You can withdraw consent at any time by deleting your account
          from the Vault page, or by writing to us. Withdrawing consent means we stop using your data, and it removes your
          account and files as described in section 6.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">5. Who we share it with</h2>
        <p>We share data only with the service providers needed to run HDVault:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium">Hosting:</span> Oracle Cloud, in its India (Mumbai) region, where the server and database are kept.</li>
          <li><span className="font-medium">Email:</span> Google (Gmail), which sends your login codes.</li>
          <li><span className="font-medium">Google sign-in:</span> Google, if you choose to sign in with Google.</li>
        </ul>
        <p>We will update this section if we add other providers, such as an SMS provider for mobile login.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">6. How long we keep it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium">Your uploaded files:</span> until you delete them or delete your account.</li>
          <li><span className="font-medium">Processed copies:</span> deleted automatically 30 days after they are created.</li>
          <li><span className="font-medium">Login codes:</span> valid for 5 minutes. Their stored, scrambled form is removed within 24 hours.</li>
          <li><span className="font-medium">Activity log and server logs:</span> kept only as long as needed to keep the service secure. We are working on an automatic deletion schedule for these.</li>
          <li><span className="font-medium">Backups:</span> copies of the database and files are kept for up to 14 days, after which they are deleted.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">7. How we protect it</h2>
        <p>
          We use HTTPS for all traffic, store login codes only in scrambled form, limit who can access each file to its owner,
          and keep the database and file storage off the public internet. Access to the server is limited to the people who run
          HDVault. No system is completely secure, so please do not upload anything you would not be comfortable sharing if it
          were ever exposed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">8. Your rights</h2>
        <p>You can ask us to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>tell you what personal data we hold about you;</li>
          <li>correct data that is wrong;</li>
          <li>delete your account and all your files and copies. You can do this yourself from the Vault page, using "Delete my account";</li>
          <li>stop using your data for any purpose you did not agree to.</li>
        </ul>
        <p>
          Send these requests to <a className="underline" href={`mailto:${STRINGS.supportEmail}`}>{STRINGS.supportEmail}</a>. We will
          reply within a reasonable time, and we aim to do so within 30 days.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">9. Documents you should not upload</h2>
        <p>
          HDVault is for photos, signatures, and 10th or 12th marksheets only. Please do not upload Aadhaar cards, PAN cards,
          passports, bank documents, or any other identity document or number. If you do, tell us and we will delete the file.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">10. Children</h2>
        <p>HDVault is not intended for children under 18. If you believe a child has given us their data, contact us and we will delete it.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">11. Changes to this policy</h2>
        <p>
          We may update this policy. When we do, we will change the date at the top and tell users through the website. Continuing
          to use HDVault after a change means you accept the updated policy.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
        <p>
          Email: <a className="underline" href={`mailto:${STRINGS.supportEmail}`}>{STRINGS.supportEmail}</a>
        </p>
      </section>

      <p className="text-sm text-slate-500">
        See also our <Link className="underline" to="/terms">Terms of Use</Link>.
      </p>
    </article>
  );
}
