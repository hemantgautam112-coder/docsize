import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SourcePicker from "../components/SourcePicker.jsx";

const documents = [
  { id: "1", original_filename: "my-photo.jpg", document_type: "photo", size_bytes: 20480 },
  { id: "2", original_filename: "sign.png", document_type: "signature", size_bytes: 4096 },
  { id: "3", original_filename: "tenth.pdf", document_type: "marksheet_10", size_bytes: 90000 },
];

function renderPicker(overrides = {}) {
  const props = {
    documents,
    selectedId: "",
    onSelect: vi.fn(),
    onUpload: vi.fn(),
    uploading: false,
    uploadError: null,
    ...overrides,
  };
  render(<SourcePicker {...props} />);
  return props;
}

describe("SourcePicker", () => {
  it("lists the device option first, then the saved files", () => {
    renderPicker();
    const options = screen.getAllByRole("option");

    expect(options[0]).toHaveTextContent("Choose a file from this device");
    expect(options).toHaveLength(4);
    expect(options[1]).toHaveTextContent("my-photo.jpg");
  });

  it("filters saved files by name or type as the user types", async () => {
    renderPicker();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/search by file name/i), "marksheet");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[1]).toHaveTextContent("tenth.pdf");
  });

  it("shows a clear message when nothing matches", async () => {
    renderPicker();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/search by file name/i), "aadhaar");

    expect(screen.getByText(/no saved files match "aadhaar"/i)).toBeInTheDocument();
  });

  it("selects a saved file when it is clicked", async () => {
    const props = renderPicker();
    const user = userEvent.setup();

    await user.click(screen.getByRole("option", { name: /sign\.png/i }));

    expect(props.onSelect).toHaveBeenCalledWith("2");
  });
});
