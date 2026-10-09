import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

beforeEach(() => {
  // Signed-out backend: the CSRF call succeeds, /auth/me returns 401.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (String(url).endsWith("/auth/csrf")) return jsonResponse({ csrf_token: "test-token" });
      if (String(url).endsWith("/auth/me")) return jsonResponse({ detail: "Please log in to continue." }, 401);
      return jsonResponse({ detail: "Not found." }, 404);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("app smoke tests", () => {
  it("shows the login tab with the independent-tool disclaimer in the footer", async () => {
    renderAt("/login");

    expect(await screen.findByRole("heading", { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByText(/not an official government website/i)).toBeInTheDocument();
  });

  it("keeps Send code to sign up disabled until the consent box is ticked", async () => {
    renderAt("/login");
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: /^log in$/i });

    await user.click(screen.getByRole("tab", { name: /sign up/i }));
    const sendButton = screen.getByRole("button", { name: /send code to sign up/i });
    expect(sendButton).toBeDisabled();

    await user.type(screen.getByLabelText(/mobile number or email/i), "9876543210");
    await user.click(screen.getByRole("checkbox"));
    expect(sendButton).toBeEnabled();
  });

  it("login tab does not ask for consent", async () => {
    renderAt("/login");
    await screen.findByRole("heading", { name: /^log in$/i });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a setup message for Google sign-in when no client ID is configured", async () => {
    renderAt("/login");

    expect(await screen.findByText(/google sign-in is not set up yet/i)).toBeInTheDocument();
  });

  it("redirects signed-out visitors from the vault to the login page", async () => {
    renderAt("/vault");

    expect(await screen.findByRole("heading", { name: /^log in$/i })).toBeInTheDocument();
  });

  it("shows the privacy page without requiring a session", async () => {
    renderAt("/privacy");

    expect(await screen.findByRole("heading", { name: /^privacy$/i })).toBeInTheDocument();
  });
});
