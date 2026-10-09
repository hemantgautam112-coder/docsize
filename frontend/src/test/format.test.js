import { describe, expect, it } from "vitest";
import { describeError } from "../api/client.js";
import { documentTypeLabel, formatKB, validateFile, validateTargetKb } from "../lib/format.js";

describe("formatKB", () => {
  it("shows kilobytes with one decimal", () => {
    expect(formatKB(11935)).toBe("11.7 KB");
  });
  it("switches to megabytes at 1 MB", () => {
    expect(formatKB(2 * 1024 * 1024)).toBe("2.00 MB");
  });
});

describe("validateTargetKb", () => {
  it("accepts whole numbers from 5 to 2000", () => {
    expect(validateTargetKb("20")).toBeNull();
    expect(validateTargetKb(2000)).toBeNull();
  });
  it("rejects values outside the range and non-integers", () => {
    expect(validateTargetKb("4")).toMatch(/between 5 and 2000/);
    expect(validateTargetKb("2001")).toMatch(/between 5 and 2000/);
    expect(validateTargetKb("12.5")).toMatch(/whole number/);
    expect(validateTargetKb("")).toMatch(/whole number/);
  });
});

describe("validateFile", () => {
  it("rejects unsupported extensions and oversize files before upload", () => {
    expect(validateFile({ name: "notes.txt", size: 10 })).toMatch(/JPG, PNG, or PDF/);
    expect(validateFile({ name: "big.jpg", size: 11 * 1024 * 1024 })).toMatch(/larger than 10 MB/);
    expect(validateFile({ name: "ok.pdf", size: 1000 })).toBeNull();
  });
});

describe("documentTypeLabel", () => {
  it("maps stored values to labels", () => {
    expect(documentTypeLabel("marksheet_10")).toBe("10th marksheet");
  });
});

describe("describeError", () => {
  it("joins validation messages and strips the pydantic prefix", () => {
    const detail = [{ msg: "Value error, Choose an exam profile or enter a target size in KB." }];
    expect(describeError(detail)).toBe("Choose an exam profile or enter a target size in KB.");
  });
  it("passes plain string details through", () => {
    expect(describeError("Document not found.")).toBe("Document not found.");
  });
});
