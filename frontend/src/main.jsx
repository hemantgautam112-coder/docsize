import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./index.css";

// Chrome fires its install signal as soon as the page loads, before the install button is on screen.
// Keep the signal here, so the button can use it whenever it appears.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__deferredInstallPrompt = event;
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
