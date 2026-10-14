import { useEffect, useState } from "react";
import Dialog from "./Dialog.jsx";
import { DOCUMENT_TYPES, formatKB, suggestTag } from "../lib/format.js";

/**
 * Shown after the phone camera takes a scan. The user picks what the scan is,
 * then uploads it either as the picture or as a one-page PDF.
 */
export default function ScanUploadDialog({ file, onCancel, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [documentType, setDocumentType] = useState(() => suggestTag(file.name, file.type));

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Dialog labelledBy="scan-dialog-title">
      <h2 id="scan-dialog-title" className="text-xl font-bold text-slate-900">Your scan</h2>
      <p className="mt-2 text-sm text-slate-600">
        Check the picture, choose what it is, then upload it as an image or as a PDF.
      </p>

      <div className="mt-4 flex max-h-[45vh] items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2">
        {previewUrl && <img src={previewUrl} alt="Your scanned document" className="max-h-[43vh] max-w-full rounded object-contain" />}
      </div>
      <p className="mt-2 text-xs text-slate-500">{file.name} · {formatKB(file.size)}</p>

      <div className="mt-4">
        <label className="label" htmlFor="scan-type">What is this?</label>
        <select id="scan-type" className="input" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Retake</button>
        <button type="button" className="btn-secondary" onClick={() => onConfirm({ file, document_type: documentType, convert_to_pdf: false })}>
          Upload as image
        </button>
        <button type="button" className="btn-primary" onClick={() => onConfirm({ file, document_type: documentType, convert_to_pdf: true })}>
          Upload as PDF
        </button>
      </div>
    </Dialog>
  );
}
