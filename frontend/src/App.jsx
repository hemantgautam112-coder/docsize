import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Vault from "./pages/Vault.jsx";
import Process from "./pages/Process.jsx";
import History from "./pages/History.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading..." />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  // The login page has its own full-screen design, so it is shown without the usual header and footer.
  if (location.pathname === "/login") {
    return <Login />;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/vault" element={<RequireAuth><Vault /></RequireAuth>} />
        <Route path="/process" element={<RequireAuth><Process /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<Navigate to="/vault" replace />} />
      </Routes>
    </Layout>
  );
}
