import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import About from "./pages/About";
import CanchaDetails from "./pages/CanchaDetails";
import ConfirmarReserva from "./pages/ConfirmarReserva";
import ReservaDetalles from "./pages/ReservaDetalles";
import NotFound from "./pages/NotFound";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/cancha/:id" element={<CanchaDetails />} />
      <Route path="/confirmar/:id" element={<ConfirmarReserva />} />
      <Route path="/reserva/:id" element={<ReservaDetalles />} />
      <Route path="/about" element={<About />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
