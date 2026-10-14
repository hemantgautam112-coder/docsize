import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

function stubBackend(options = { mobile_login_enabled: true }) {
  const fetchMock = vi.fn(async (url) => {
    if (String(url).endsWith("/auth/csrf")) return jsonResponse({ csrf_token: "test-token" });
    if (String(url).endsWith("/auth/me")) return jsonResponse({ detail: "Please log in to continue." }, 401);
    if (String(url).endsWith("/auth/options")) return jsonResponse({ ...options, google_enabled: false });
    if (String(url).endsWith("/auth/request-otp")) return jsonResponse({ message: "We sent a code." }, 202);
    return jsonResponse({ detail: "Not found." }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function signUpForm() {
  return within(screen.getByRole("form", { name: "Sign Up" }));
}

beforeEach(() => {
  stubBackend();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login page", () => {
  it("opens on Sign Up, with the Lets Start Resizing heading and the independent-tool note", async () => {
    renderAt("/login");

    expect(await screen.findByRole("heading", { name: /start resizing/i })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign Up" })).toBeInTheDocument();
    expect(screen.getAllByText(/not affiliated with any government body/i).length).toBeGreaterThan(0);
  });

  it("warns and sends no code when Sign Up is clicked without accepting the privacy policy", async () => {
    const fetchMock = stubBackend();
    renderAt("/login");
    const user = userEvent.setup();
    await screen.findByRole("form", { name: "Sign Up" });

    await user.type(screen.getByLabelText(/email address|mobile number or email/i), "student@example.com");
    await user.click(signUpForm().getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText(/please accept the privacy policy and terms before you sign up/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/request-otp"))).toBe(false);
  });

  it("warns instead of opening Google sign-up until the privacy policy box is ticked", async () => {
    renderAt("/login");
    const user = userEvent.setup();
    await screen.findByRole("form", { name: "Sign Up" });

    await user.click(screen.getByRole("button", { name: /accept the privacy policy first to sign up with google/i }));

    expect(await screen.findByText(/sign up with google\. tick the box/i)).toBeInTheDocument();
  });

  it("the Login option hides the consent box", async () => {
    renderAt("/login");
    const user = userEvent.setup();
    await screen.findByRole("form", { name: "Sign Up" });

    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("form", { name: "Login" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("hides the mobile option when the server has mobile login switched off", async () => {
    stubBackend({ mobile_login_enabled: false });
    renderAt("/login");

    expect(await screen.findByText(/mobile number login is coming soon/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your Email")).toBeInTheDocument();
  });

  it("shows a setup message for Google sign-in when no client ID is configured", async () => {
    renderAt("/login");

    expect(await screen.findByText(/google sign-in is not set up yet/i)).toBeInTheDocument();
  });

  it("redirects signed-out visitors from the vault to the login page", async () => {
    renderAt("/vault");

    expect(await screen.findByRole("heading", { name: /start resizing/i })).toBeInTheDocument();
  });

  it("shows the privacy page without requiring a session", async () => {
    renderAt("/privacy");

    expect(await screen.findByRole("heading", { name: /privacy policy/i })).toBeInTheDocument();
  });
});

describe("scan dialog", () => {
  it("offers Upload as image and Upload as PDF", async () => {
    URL.createObjectURL = vi.fn(() => "blob:scan-preview");
    URL.revokeObjectURL = vi.fn();
    const { default: ScanUploadDialog } = await import("../components/ScanUploadDialog.jsx");
    const onConfirm = vi.fn();
    const file = new File(["x"], "scan.jpg", { type: "image/jpeg" });
    render(<ScanUploadDialog file={file} onCancel={() => {}} onConfirm={onConfirm} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /upload as pdf/i }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ convert_to_pdf: true, document_type: "photo" });
  });
});
