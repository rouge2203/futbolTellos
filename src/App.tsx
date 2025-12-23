import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";

// Public pages
import Index from "./pages/Index";
import About from "./pages/About";
import CanchaDetails from "./pages/CanchaDetails";
import ConfirmarReserva from "./pages/ConfirmarReserva";
import ReservaDetalles from "./pages/ReservaDetalles";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

// Admin pages
import ProtectedRoute from "./components/admin/ProtectedRoute";
import Dashboard from "./pages/admin/Dashboard";
import Reservas from "./pages/admin/Reservas";
import Canchas from "./pages/admin/Canchas";
import Configuracion from "./pages/admin/Configuracion";

function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        {/* Public Routes with Client Layout */}
        <Route
          path="/"
          element={
            <Layout>
              <Index />
            </Layout>
          }
        />
        <Route
          path="/cancha/:id"
          element={
            <Layout>
              <CanchaDetails />
            </Layout>
          }
        />
        <Route
          path="/confirmar/:id"
          element={
            <Layout>
              <ConfirmarReserva />
            </Layout>
          }
        />
        <Route
          path="/reserva/:id"
          element={
            <Layout>
              <ReservaDetalles />
            </Layout>
          }
        />
        <Route
          path="/about"
          element={
            <Layout>
              <About />
            </Layout>
          }
        />

        {/* Login - No Layout */}
        <Route path="/login" element={<Login />} />

        {/* Protected Admin Routes - Admin Layout included in each page */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reservas"
          element={
            <ProtectedRoute>
              <Reservas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/canchas"
          element={
            <ProtectedRoute>
              <Canchas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/configuracion"
          element={
            <ProtectedRoute>
              <Configuracion />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={
            <Layout>
              <NotFound />
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
