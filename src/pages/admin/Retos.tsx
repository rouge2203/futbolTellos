import { useState, useEffect, useCallback, useRef, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import RetoDrawer from "../../components/admin/RetoDrawer";
import CreateRetoDialog from "../../components/admin/CreateRetoDialog";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { fetchAllPages } from "../../lib/fetchAllPages";
import { canchaPrice, getRetoStatus, RETOS_PAGE_SIZE, retoStartTime, type RetoStatus } from "../../lib/retos";

interface Reto {
  id: string;
  hora_inicio: string;
  hora_fin: string;
  local: string;
  fut: number;
  arbitro: boolean;
  precio: number | null;
  equipo1_nombre: string | null;
  equipo1_encargado: string;
  equipo1_celular: string;
  equipo1_correo: string | null;
  equipo2_nombre: string | null;
  equipo2_encargado: string | null;
  equipo2_celular: string | null;
  cancha_id: number;
  reserva_id: string | null;
  cancha?: { id: number; nombre: string; img?: string; precio?: string; local: number; cantidad?: string };
}

const labels: Record<RetoStatus, string> = { open: "Retos abiertos", closed: "Retos Próximos", past: "Retos pasados" };
const currency = (price: number) => `₡ ${price.toLocaleString("es-CR")}`;

export default function Retos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [retos, setRetos] = useState<Reto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<RetoStatus>("open");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [selectedReto, setSelectedReto] = useState<Reto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchRetos = useCallback(async () => {
    setError("");
    try {
      const data = await fetchAllPages<Reto>((from, to) => supabase.from("retos")
        .select("*, cancha:cancha_id (id, nombre, img, precio, local, cantidad)")
        .order("hora_inicio", { ascending: false }).order("id").range(from, to));
      setRetos(data);
      setNow(Date.now());
      setSelectedReto(current => current ? data.find(r => r.id === current.id) ?? null : null);
    } catch {
      setError("No se pudieron cargar los retos. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRetos();
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [fetchRetos]);

  const groups = { open: [] as Reto[], closed: [] as Reto[], past: [] as Reto[] };
  retos.forEach(reto => groups[getRetoStatus(reto, now)].push(reto));
  groups.open.reverse();
  groups.closed.reverse();
  const currentRetos = groups[activeTab];
  const totalPages = Math.max(1, Math.ceil(currentRetos.length / RETOS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * RETOS_PAGE_SIZE;
  const visibleRetos = currentRetos.slice(start, start + RETOS_PAGE_SIZE);

  // Deletes the linked reservation; retos_reserva_id_fkey cascades to the reto.
  const handleDelete = async (id: string) => {
    const { error } = await supabase.rpc("eliminar_reto", { p_reto_id: id });
    if (error) throw error;
    await fetchRetos();
  };

  // Drops only the reto. The reservation, its pagos and its owner_reminder stay;
  // whatsapp_notifications_reto_id_fkey cascades away the team2_reminder.
  const handleDeleteRetoOnly = async (id: string) => {
    const { error } = await supabase.from("retos").delete().eq("id", id);
    if (error) throw error;
    await fetchRetos();
  };

  const openReto = (reto: Reto) => { setSelectedReto(reto); setDrawerOpen(true); };

  // A touch that travels is a scroll, not a tap, so the row only opens on a still
  // press. Taps on the row's own buttons are left to those buttons.
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const handleRowPointerUp = (reto: Reto) => (e: PointerEvent<HTMLTableRowElement>) => {
    const press = pressAt.current;
    pressAt.current = null;
    if (!press) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) return;
    if ((e.target as HTMLElement).closest("button")) return;
    openReto(reto);
  };

  return (
    <AdminLayout title="Retos">
      <div className="min-h-screen w-full">
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Lista de retos</h2>
            <button onClick={() => setCreateOpen(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">Crear reto</button>
          </div>
          <div role="tablist" aria-label="Estado de los retos" className="flex gap-6 overflow-x-auto border-b border-gray-200">
            {(Object.keys(labels) as RetoStatus[]).map(status => (
              <button key={status} role="tab" aria-selected={activeTab === status} onClick={() => { setActiveTab(status); setPage(1); }}
                className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium ${activeTab === status ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
                {labels[status]} ({groups[status].length})
              </button>
            ))}
          </div>
          {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error} <button onClick={fetchRetos} className="underline">Reintentar</button></div>}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                {["Equipo 1", "Equipo 2", "Cancha", "Fecha / hora", "Local", "FUT", "Árbitro", "Precio total", "Acciones"].map(label => (
                  <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{label}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? <tr><td colSpan={9} className="p-8 text-center text-sm text-gray-500">Cargando retos…</td></tr> : visibleRetos.length === 0 ?
                  <tr><td colSpan={9} className="p-8 text-center text-sm text-gray-500">No hay {labels[activeTab].toLowerCase()}.</td></tr> : visibleRetos.map(reto => (
                  <tr key={reto.id}
                    onPointerDown={e => { pressAt.current = { x: e.clientX, y: e.clientY }; }}
                    onPointerUp={handleRowPointerUp(reto)}
                    className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{reto.equipo1_encargado || "Pendiente"}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{reto.equipo2_encargado || <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Pendiente</span>}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">{reto.cancha?.nombre || "Sin cancha"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                      <div>{new Date(retoStartTime(reto.hora_inicio)).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric" })}</div>
                      <div className="text-gray-500">{new Date(retoStartTime(reto.hora_inicio)).toLocaleTimeString("es-CR", { timeZone: "America/Costa_Rica", hour: "numeric", minute: "2-digit", hour12: true })}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">{reto.local}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">{reto.fut}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">{reto.arbitro ? "Sí" : "No"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-gray-900">{currency(reto.precio ?? (reto.cancha ? canchaPrice(reto.cancha, reto.fut, reto.arbitro) : 0))}</td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => openReto(reto)} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/80">Ver reto</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginación de retos" className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <p>{currentRetos.length ? `${start + 1}–${Math.min(start + RETOS_PAGE_SIZE, currentRetos.length)} de ${currentRetos.length} retos` : "0 retos"} · 25 por página</p>
            <div className="flex items-center gap-3">
              <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-md border border-gray-300 px-3 py-2 disabled:opacity-40">Anterior</button>
              <span>Página {currentPage} de {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-md border border-gray-300 px-3 py-2 disabled:opacity-40">Siguiente</button>
            </div>
          </nav>
        </div>
      </div>
      <RetoDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); void fetchRetos(); }} reto={selectedReto}
        mode={selectedReto && getRetoStatus(selectedReto, now) === "open" ? "assign" : "view"}
        onReservaCreated={async () => { await fetchRetos(); setDrawerOpen(false); }} onRefresh={fetchRetos} onDelete={handleDelete} onDeleteRetoOnly={handleDeleteRetoOnly} user={user} />
      <CreateRetoDialog open={createOpen} onClose={() => setCreateOpen(false)} onNavigate={() => navigate("/admin", { state: { crearReserva: true } })} />
    </AdminLayout>
  );
}
