import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TagUploadDialog from "../components/TagUploadDialog.jsx";
import { suggestTag } from "../lib/format.js";

describe("suggestTag", () => {
  it("recognises common file names", () => {
    expect(suggestTag("my-signature.png", "image/png")).toBe("signature");
    expect(suggestTag("left_thumb.jpg", "image/jpeg")).toBe("thumb");
    expect(suggestTag("10th-marksheet.pdf", "application/pdf")).toBe("marksheet_10");
    expect(suggestTag("12th_marks.pdf", "application/pdf")).toBe("marksheet_12");
    expect(suggestTag("My_pic.jpg", "image/jpeg")).toBe("photo");
  });
  it("falls back to other for unknown PDFs and photo for unknown images", () => {
    expect(suggestTag("certificate.pdf", "application/pdf")).toBe("other");
    expect(suggestTag("scan.jpg", "image/jpeg")).toBe("photo");
  });
});

describe("TagUploadDialog", () => {
  it("uploads with suggested tags when the user changes nothing", async () => {
    const onConfirm = vi.fn();
    const files = [new File(["x"], "my-signature.png", { type: "image/png" })];
    render(<TagUploadDialog files={files} onCancel={() => {}} onConfirm={onConfirm} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /upload 1 file/i }));

    expect(onConfirm).toHaveBeenCalledWith([{ file: files[0], document_type: "signature" }]);
  });

  it("uses the tag the user picks", async () => {
    const onConfirm = vi.fn();
    const files = [new File(["x"], "scan.jpg", { type: "image/jpeg" })];
    render(<TagUploadDialog files={files} onCancel={() => {}} onConfirm={onConfirm} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/tag for scan\.jpg/i), "graduation");
    await user.click(screen.getByRole("button", { name: /upload 1 file/i }));

    expect(onConfirm.mock.calls[0][0][0].document_type).toBe("graduation");
  });
});
