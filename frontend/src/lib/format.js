/** Display helpers and client-side checks. Backend validation is the real check. */

export const DOCUMENT_TYPES = [
  { value: "photo", label: "Photo" },
  { value: "signature", label: "Signature" },
  { value: "thumb", label: "Thumb impression" },
  { value: "marksheet_10", label: "10th marksheet" },
  { value: "marksheet_12", label: "12th marksheet" },
  { value: "graduation", label: "Graduation certificate" },
  { value: "other", label: "Other document" },
];

export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const TARGET_KB_MIN = 5;
export const TARGET_KB_MAX = 2000;

export function documentTypeLabel(value) {
  return DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? value;
}

export function isPdfMime(mimeType) {
  return mimeType === "application/pdf";
}

export function formatKB(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatDateTime(isoString) {
  if (!isoString) return "";
  // The backend stores UTC without a timezone suffix, so add one before parsing.
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(isoString);
  return new Date(hasZone ? isoString : `${isoString}Z`).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function isPast(isoString) {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(isoString);
  return new Date(hasZone ? isoString : `${isoString}Z`) <= new Date();
}

export function documentSummary(doc) {
  if (doc.page_count) return `${doc.page_count} page${doc.page_count === 1 ? "" : "s"}`;
  if (doc.width_px && doc.height_px) return `${doc.width_px} × ${doc.height_px} px`;
  return "";
}

/** Returns an error message for a target size, or null when it is valid. */
export function validateTargetKb(value) {
  const number = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isInteger(number)) {
    return "Enter the target size as a whole number of KB.";
  }
  if (number < TARGET_KB_MIN || number > TARGET_KB_MAX) {
    return `The target size must be between ${TARGET_KB_MIN} and ${TARGET_KB_MAX} KB.`;
  }
  return null;
}

export function validateFile(file) {
  if (!file) return "Choose a file to upload.";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Only JPG, PNG, or PDF files can be uploaded.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "This file is larger than 10 MB. Compress it or scan it at a lower resolution, then try again.";
  }
  if (file.size === 0) return "This file is empty.";
  return null;
}
