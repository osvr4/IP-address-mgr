import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Shell from "./pages/Shell";
import Dashboard from "./pages/Dashboard";
import RequestIP from "./pages/RequestIP";
import MyIPs from "./pages/MyIPs";
import SubnetMap from "./pages/SubnetMap";
import AllAddresses from "./pages/AllAddresses";
import Conflicts from "./pages/Conflicts";
import LongHeld from "./pages/LongHeld";
import UsersAdmin from "./pages/UsersAdmin";
import AuditLog from "./pages/AuditLog";
import ImportExcel from "./pages/ImportExcel";
import Backups from "./pages/Backups";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-mono text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin" && user.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-mono text-sm">
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            }
          />

          {/* Protected routes wrapped in Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="request" element={<RequestIP />} />
            <Route path="mine" element={<MyIPs />} />
            <Route path="map" element={<SubnetMap />} />

            {/* Admin only routes */}
            <Route
              path="admin/addresses"
              element={
                <ProtectedRoute adminOnly>
                  <AllAddresses />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/conflicts"
              element={
                <ProtectedRoute adminOnly>
                  <Conflicts />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/long-held"
              element={
                <ProtectedRoute adminOnly>
                  <LongHeld />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute adminOnly>
                  <UsersAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/audit"
              element={
                <ProtectedRoute adminOnly>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/import"
              element={
                <ProtectedRoute adminOnly>
                  <ImportExcel />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/backups"
              element={
                <ProtectedRoute adminOnly>
                  <Backups />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
