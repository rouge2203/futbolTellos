import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import ReservationDrawer from "../../components/admin/ReservationDrawer";
import CreateReservationDrawer from "../../components/admin/CreateReservationDrawer";
import SuccessNotification from "../../components/admin/SuccessNotification";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/20/solid";
import { GiWhistle } from "react-icons/gi";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  local: number;
  cantidad?: string;
  precio?: string;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  correo_reserva: string;
  sinpe_reserva: string | null;
  confirmada: boolean | null;
  confirmada_por: string | null;
  precio: number;
  arbitro: boolean;
  cancha: Cancha;
  reservacion_fija_id: number | null;
}

const MONTHS_SPANISH = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

export default function Reservas2() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [selectedCanchaId, setSelectedCanchaId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "cancel">("edit");
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);

  // Create drawer state
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Fetch canchas
  useEffect(() => {
    const fetchCanchas = async () => {
      try {
        const { data, error } = await supabase
          .from("canchas")
          .select("id, nombre, img, local")
          .order("id");

        if (error) throw error;
        // Sort canchas: Sabana first, then Guadalupe, then by id ascending
        const sortedCanchas = (data || []).sort((a, b) => {
          if (a.local !== b.local) {
            return a.local - b.local;
          }
          return a.id - b.id;
        });
        setCanchas(sortedCanchas);
      } catch (error) {
        console.error("Error fetching canchas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCanchas();
  }, []);

  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseDateFromTimestamp = (timestamp: string): Date => {
    const match = timestamp.match(
      /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/
    );
    if (match) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6])
      );
    }
    return new Date(timestamp);
  };

  // Fetch reservations for selected date and cancha
  const fetchReservas = async () => {
    setLoadingReservas(true);
    try {
      const dateStr = formatLocalDate(selectedDate);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      const LINKED_CANCHAS = [1, 3, 5];
      let canchaIds: number[];
      if (selectedCanchaId === 6) {
        canchaIds = [6, ...LINKED_CANCHAS];
      } else if (LINKED_CANCHAS.includes(selectedCanchaId)) {
        canchaIds = [selectedCanchaId, 6];
      } else {
        canchaIds = [selectedCanchaId];
      }

      const { data, error } = await supabase
        .from("reservas")
        .select(
          `
            id,
            hora_inicio,
            hora_fin,
            nombre_reserva,
            celular_reserva,
            correo_reserva,
            sinpe_reserva,
            confirmada,
            confirmada_por,
            precio,
            arbitro,
            cancha:cancha_id (
              id,
              nombre,
              img,
              local
            )
          `
        )
        .in("cancha_id", canchaIds)
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay)
        .order("hora_inicio", { ascending: true });

      if (error) throw error;

      const mappedReservas: Reserva[] = (data || []).map((r: any) => ({
        ...r,
        cancha: Array.isArray(r.cancha) ? r.cancha[0] : r.cancha,
      }));

      setReservas(mappedReservas);
    } catch (error) {
      console.error("Error fetching reservas:", error);
    } finally {
      setLoadingReservas(false);
    }
  };

  useEffect(() => {
    fetchReservas();
  }, [selectedDate, selectedCanchaId]);

  // Calculate earliest hour needed (7 AM or earlier if reservations exist before 7 AM)
  const getEarliestHour = (): number => {
    if (reservas.length === 0) return 7;
    const earliestHour = Math.min(
      ...reservas.map((r) => {
        const date = parseDateFromTimestamp(r.hora_inicio);
        return date.getHours();
      })
    );
    return Math.min(earliestHour, 7);
  };

  const earliestHour = getEarliestHour();
  const totalHours = 24 - earliestHour; // Hours from earliestHour to 24 (midnight)
  const totalRows = totalHours * 2; // 30-minute intervals

  // Calculate grid row position from time
  // Row 1 is header, rows 2+ are time slots starting from earliestHour
  const getGridRowFromTime = (timestamp: string): number => {
    const date = parseDateFromTimestamp(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Calculate row relative to earliestHour, each hour = 2 rows (30 min intervals)
    // Add 2 to account for header row (row 1) and first time slot starting at row 2
    const hourOffset = hours - earliestHour;
    return hourOffset * 2 + (minutes >= 30 ? 1 : 0) + 2;
  };

  // Calculate grid row span (duration)
  const getGridRowSpan = (horaInicio: string, horaFin: string): number => {
    const start = parseDateFromTimestamp(horaInicio);
    const end = parseDateFromTimestamp(horaFin);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    // Round to nearest 30 min interval
    return Math.max(1, Math.round(diffHours * 2));
  };

  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const formatDateDisplay = (
    date: Date
  ): {
    day: number;
    month: string;
    year: number;
    dayOfWeek: string;
  } => {
    const day = date.getDate();
    const month = MONTHS_SPANISH[date.getMonth()];
    const year = date.getFullYear();
    const dayOfWeek = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ][date.getDay()];
    return { day, month, year, dayOfWeek };
  };

  const handleReservaClick = async (reservaId: number) => {
    try {
      const { data, error } = await supabase
        .from("reservas")
        .select(
          `
          *,
          cancha:cancha_id (
            id,
            nombre,
            img,
            local,
            cantidad,
            precio
          )
        `
        )
        .eq("id", reservaId)
        .single();

      if (error) throw error;

      const reserva: Reserva = {
        ...data,
        cancha: Array.isArray(data.cancha) ? data.cancha[0] : data.cancha,
      };

      setSelectedReserva(reserva);
      setDrawerMode("edit");
      setDrawerOpen(true);
    } catch (error) {
      console.error("Error fetching reserva details:", error);
    }
  };

  const handleUpdateReserva = async (updates: {
    hora_inicio: string;
    hora_fin: string;
    nombre_reserva: string;
    correo_reserva: string;
    celular_reserva: string;
    precio: number;
    cancha_id?: number;
  }) => {
    if (!selectedReserva) return;

    try {
      const updateData: any = {
        hora_inicio: updates.hora_inicio,
        hora_fin: updates.hora_fin,
        nombre_reserva: updates.nombre_reserva,
        correo_reserva: updates.correo_reserva,
        celular_reserva: updates.celular_reserva,
        precio: updates.precio,
      };

      if (updates.cancha_id) {
        updateData.cancha_id = updates.cancha_id;
      }

      const { error } = await supabase
        .from("reservas")
        .update(updateData)
        .eq("id", selectedReserva.id);

      if (error) throw error;

      await fetchReservas();
      if (selectedReserva) {
        await handleReservaClick(selectedReserva.id);
      }
    } catch (error) {
      console.error("Error updating reserva:", error);
      throw error;
    }
  };

  const handleConfirmSinpe = async (
    reservaId: number,
    _hasComprobante: boolean
  ) => {
    if (!user) return;

    try {
      // First, get the reservation details to calculate the adelanto
      const { data: reservaData, error: fetchError } = await supabase
        .from("reservas")
        .select("precio")
        .eq("id", reservaId)
        .single();

      if (fetchError) throw fetchError;

      const adelanto = Math.ceil((reservaData?.precio || 0) / 2);
      const username = user.email ? user.email.split("@")[0] : user.id;

      const updateData: any = {
        confirmada: true,
        confirmada_por: user.email || user.id,
      };

      const { error } = await supabase
        .from("reservas")
        .update(updateData)
        .eq("id", reservaId);

      if (error) throw error;

      // Check if a pago for this SINPE confirmation already exists
      const { data: existingPago } = await supabase
        .from("pagos")
        .select("id")
        .eq("reserva_id", reservaId)
        .eq("nota", "Adelanto SINPE confirmado")
        .maybeSingle();

      // Only create pago if one doesn't already exist
      if (!existingPago) {
        // Get the sinpe_reserva URL to store in sinpe_pago
        const { data: reservaWithSinpe } = await supabase
          .from("reservas")
          .select("sinpe_reserva")
          .eq("id", reservaId)
          .single();

        const { error: pagoError } = await supabase.from("pagos").insert({
          reserva_id: reservaId,
          monto_sinpe: adelanto,
          monto_efectivo: 0,
          nota: "Adelanto SINPE confirmado",
          completo: false,
          creado_por: username,
          sinpe_pago: reservaWithSinpe?.sinpe_reserva || null,
        });

        if (pagoError) {
          console.error("Error creating pago record:", pagoError);
          // Don't throw - the SINPE confirmation was successful, just log the pago error
        }
      }

      await fetchReservas();
      if (selectedReserva) {
        await handleReservaClick(reservaId);
      }
    } catch (error) {
      console.error("Error confirming SINPE:", error);
      throw error;
    }
  };

  const handleDeleteReserva = async (reservaId: number) => {
    try {
      const { error } = await supabase
        .from("reservas")
        .delete()
        .eq("id", reservaId);

      if (error) throw error;
      await fetchReservas();
    } catch (error) {
      console.error("Error deleting reserva:", error);
      throw error;
    }
  };

  const handleCrearReservacion = () => {
    setCreateDrawerOpen(true);
  };

  const handleReservationCreated = async (reservaId: number) => {
    await fetchReservas();
    setShowSuccessNotification(true);
    // Open drawer for the newly created reservation
    await handleReservaClick(reservaId);
  };

  // Generate calendar days for side panel
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    const startDay = firstDay.getDay();
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  const selectedCancha = canchas.find((c) => c.id === selectedCanchaId);
  const dateDisplay = formatDateDisplay(selectedDate);
  const calendarDays = getDaysInMonth(currentMonth);

  // Get canchas for filter badges - sorted by location then id
  const sabanaCanchas = canchas
    .filter((c) => c.local === 1)
    .sort((a, b) => a.id - b.id);
  const guadalupeCanchas = canchas
    .filter((c) => c.local === 2)
    .sort((a, b) => a.id - b.id);
  const filterCanchas = [...sabanaCanchas, ...guadalupeCanchas];

  // Generate time slots starting from earliestHour (30-minute intervals)
  const timeSlots = Array.from({ length: totalRows }, (_, i) => {
    const slotIndex = earliestHour * 2 + i; // Start from earliestHour
    const hour = Math.floor(slotIndex / 2);
    const minute = slotIndex % 2 === 0 ? 0 : 30;
    const period = hour < 12 ? "AM" : "PM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      hour,
      minute,
      display: `${displayHour}:${minute.toString().padStart(2, "0")}${period}`,
      isHour: minute === 0,
    };
  });

  if (loading) {
    return (
      <AdminLayout title="Reservaciones por hora">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Reservaciones por hora">
      <div className="flex h-full flex-col">
        <header className="flex flex-none items-center  justify-between border-b border-gray-200 px-0 py-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              <time
                dateTime={formatLocalDate(selectedDate)}
                className="sm:hidden"
              >
                {dateDisplay.day} {dateDisplay.month}, {dateDisplay.year}
              </time>
              <time
                dateTime={formatLocalDate(selectedDate)}
                className="hidden sm:inline"
              >
                {dateDisplay.day} de {dateDisplay.month} de {dateDisplay.year}
              </time>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {dateDisplay.dayOfWeek}
            </p>
          </div>
          <div className="flex items-center">
            <div className="relative flex items-center rounded-md bg-white shadow-xs outline -outline-offset-1 outline-gray-300 md:items-stretch">
              <button
                type="button"
                onClick={handlePrevDay}
                className="flex h-9 w-12 items-center justify-center rounded-l-md pr-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pr-0 md:hover:bg-gray-50"
              >
                <span className="sr-only">Día anterior</span>
                <ChevronLeftIcon aria-hidden="true" className="size-5" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="hidden px-3.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:relative md:block"
              >
                Hoy
              </button>
              <span className="relative -mx-px h-5 w-px bg-gray-300 md:hidden" />
              <button
                type="button"
                onClick={handleNextDay}
                className="flex h-9 w-12 items-center justify-center rounded-r-md pl-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pl-0 md:hover:bg-gray-50"
              >
                <span className="sr-only">Día siguiente</span>
                <ChevronRightIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="hidden md:ml-4 md:flex md:items-center">
              <Menu as="div" className="relative">
                <MenuButton
                  type="button"
                  className="flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50"
                >
                  {selectedCancha?.nombre || "Seleccionar Cancha"}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="-mr-1 size-5 text-gray-400"
                  />
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-3 w-48 origin-top-right overflow-hidden rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  <div className="py-1">
                    {canchas.map((cancha) => (
                      <MenuItem key={cancha.id}>
                        <button
                          onClick={() => setSelectedCanchaId(cancha.id)}
                          className={`block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden ${
                            selectedCanchaId === cancha.id
                              ? "bg-gray-100 font-semibold"
                              : ""
                          }`}
                        >
                          {cancha.nombre}
                        </button>
                      </MenuItem>
                    ))}
                  </div>
                </MenuItems>
              </Menu>
              <div className="ml-6 h-6 w-px bg-gray-300" />
              <button
                type="button"
                onClick={handleCrearReservacion}
                className="ml-6 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Crear reservación
              </button>
            </div>
            <div className="ml-6 md:hidden">
              <Menu as="div" className="relative">
                <MenuButton className="relative flex items-center rounded-full text-gray-400 outline-offset-8 hover:text-gray-500">
                  <span className="absolute -inset-2" />
                  <span className="sr-only">Abrir menú</span>
                  <EllipsisHorizontalIcon
                    aria-hidden="true"
                    className="size-5"
                  />
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-3 w-36 origin-top-right divide-y divide-gray-100 overflow-hidden rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  <div className="py-1">
                    <MenuItem>
                      <button
                        onClick={handleCrearReservacion}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden"
                      >
                        Crear reservación
                      </button>
                    </MenuItem>
                  </div>
                  <div className="py-1">
                    <MenuItem>
                      <button
                        onClick={handleToday}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden"
                      >
                        Ir a hoy
                      </button>
                    </MenuItem>
                  </div>
                  <div className="py-1">
                    {canchas.map((cancha) => (
                      <MenuItem key={cancha.id}>
                        <button
                          onClick={() => setSelectedCanchaId(cancha.id)}
                          className={`block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden ${
                            selectedCanchaId === cancha.id
                              ? "bg-gray-100 font-semibold"
                              : ""
                          }`}
                        >
                          {cancha.nombre}
                        </button>
                      </MenuItem>
                    ))}
                  </div>
                </MenuItems>
              </Menu>
            </div>
          </div>
        </header>
        {/* Cancha Badge Selection */}
        <div className="border-b border-gray-200 bg-white px-4 py-4">
          <div className="mb-6 flex flex-wrap gap-2">
            {filterCanchas.map((cancha) => {
              const isSabana = cancha.local === 1;
              const isSelected = selectedCanchaId === cancha.id;
              return (
                <button
                  key={cancha.id}
                  onClick={() => setSelectedCanchaId(cancha.id)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    isSelected
                      ? isSabana
                        ? "bg-green-800 text-white"
                        : "bg-blue-800 text-white"
                      : isSabana
                      ? "bg-gray-200 text-green-800 hover:bg-gray-300"
                      : "bg-gray-200 text-blue-800 hover:bg-gray-300"
                  }`}
                >
                  {cancha.nombre}
                </button>
              );
            })}
          </div>
        </div>
        {/* Mobile Cancha Display */}
        <div className="md:hidden border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Cancha seleccionada</p>
              <p className="text-sm font-semibold text-gray-900">
                {selectedCancha?.nombre || "Seleccionar Cancha"}
              </p>
            </div>
            <Menu as="div" className="relative">
              <MenuButton
                type="button"
                className="flex items-center gap-x-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cambiar
                <ChevronDownIcon
                  aria-hidden="true"
                  className="-mr-1 size-4 text-gray-400"
                />
              </MenuButton>

              <MenuItems
                transition
                className="absolute right-0 z-10 mt-2 w-48 origin-top-right overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
              >
                <div className="py-1">
                  {canchas.map((cancha) => (
                    <MenuItem key={cancha.id}>
                      <button
                        onClick={() => setSelectedCanchaId(cancha.id)}
                        className={`block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden ${
                          selectedCanchaId === cancha.id
                            ? "bg-gray-100 font-semibold"
                            : ""
                        }`}
                      >
                        {cancha.nombre}
                      </button>
                    </MenuItem>
                  ))}
                </div>
              </MenuItems>
            </Menu>
          </div>
        </div>
        <div className="isolate flex flex-auto overflow-hidden bg-white rounded-lg sm:px-1">
          <div className="flex flex-auto flex-col overflow-auto">
            <div className="sticky top-0 z-10 grid flex-none grid-cols-7 bg-white text-xs text-gray-500 shadow-sm ring-1 ring-black/5 md:hidden">
              {DAYS_SHORT.map((day, index) => {
                const date = new Date(selectedDate);
                date.setDate(
                  selectedDate.getDate() + (index - selectedDate.getDay())
                );
                const isSelected = isSameDay(date, selectedDate);
                const isTodayDate = isToday(date);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedDate(new Date(date))}
                    className="flex flex-col items-center pt-3 pb-1.5"
                  >
                    <span>{day}</span>
                    <span
                      className={`mt-3 flex size-8 items-center justify-center rounded-full text-base font-semibold ${
                        isSelected
                          ? "bg-primary text-white"
                          : isTodayDate
                          ? "text-primary"
                          : "text-gray-900"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex w-full flex-auto">
              <div className="w-14 flex-none bg-white ring-1 ring-gray-100" />
              <div className="grid flex-auto grid-cols-1 grid-rows-1">
                {/* Horizontal lines */}
                <div
                  style={{
                    gridTemplateRows: `repeat(${totalRows}, minmax(3.5rem, 1fr))`,
                  }}
                  className="col-start-1 col-end-2 row-start-1 grid divide-y divide-gray-100"
                >
                  <div className="row-end-1 h-7" />
                  {timeSlots.map((slot, index) => (
                    <div key={index}>
                      {slot.isHour && (
                        <div className="-mt-2.5 -ml-14 w-14 pr-2 text-right text-xs/5 text-gray-400">
                          {slot.display}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Events */}
                <ol
                  style={{
                    gridTemplateRows: `1.75rem repeat(${totalRows}, minmax(0, 1fr)) auto`,
                  }}
                  className="col-start-1 col-end-2 row-start-1 grid grid-cols-1"
                >
                  {loadingReservas ? (
                    <li className="col-span-full flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </li>
                  ) : (
                    reservas.map((reserva) => {
                      const startRow = getGridRowFromTime(reserva.hora_inicio);
                      const span = getGridRowSpan(
                        reserva.hora_inicio,
                        reserva.hora_fin
                      );
                      const isSabana = reserva.cancha.local === 1;
                      const sinpePendiente =
                        isSabana &&
                        reserva.sinpe_reserva === null &&
                        !reserva.confirmada;
                      const sinpeFaltaConfirmar =
                        isSabana &&
                        reserva.sinpe_reserva !== null &&
                        !reserva.confirmada;
                      const sinpeConfirmado =
                        isSabana && reserva.confirmada === true;
                      const isConfirmed = reserva.confirmada === true;

                      return (
                        <li
                          key={reserva.id}
                          style={{ gridRow: `${startRow} / span ${span}` }}
                          className="relative mt-px flex"
                        >
                          <button
                            onClick={() => handleReservaClick(reserva.id)}
                            className={`group absolute hover:cursor-pointer inset-1 flex flex-col items-center justify-center overflow-hidden rounded-lg p-3 pb-2 text-center hover:opacity-90 transition-all ${
                              isConfirmed
                                ? "bg-primary/10 border border-primary/30"
                                : "bg-primary/20 border border-primary/40"
                            }`}
                          >
                            <p
                              className={`text-base font-semibold mb-1 ${
                                isConfirmed ? "text-primary" : "text-primary/80"
                              }`}
                            >
                              {reserva.nombre_reserva}
                            </p>
                            <p
                              className={`text-sm mb-1 ${
                                isConfirmed
                                  ? "text-primary/70"
                                  : "text-primary/60"
                              } group-hover:text-primary`}
                            >
                              {reserva.cancha.nombre}
                            </p>
                            <p
                              className={`text-sm mb-1 ${
                                isConfirmed
                                  ? "text-primary/70"
                                  : "text-primary/60"
                              } group-hover:text-primary`}
                            >
                              <time dateTime={reserva.hora_inicio}>
                                {new Date(
                                  reserva.hora_inicio
                                ).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </time>
                            </p>

                            {/* Arbitro indicator */}
                            {reserva.arbitro && (
                              <div className="flex items-center gap-1 mb-1">
                                <GiWhistle className="text-primary text-sm" />
                                <p
                                  className={`text-xs ${
                                    isConfirmed
                                      ? "text-primary/70"
                                      : "text-primary/60"
                                  } group-hover:text-primary`}
                                >
                                  Incluye árbitro
                                </p>
                              </div>
                            )}

                            {/* SINPE Status Badges - Absolute positioned in bottom right */}
                            {isSabana && (
                              <div className="absolute bottom-2 right-2">
                                {sinpePendiente ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-800 shadow-sm">
                                    <span className="size-1 rounded-full bg-yellow-500"></span>
                                    SINPE Pendiente
                                  </span>
                                ) : sinpeFaltaConfirmar ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/40 px-1.5 py-0.5 text-[9px] font-semibold text-primary shadow-sm">
                                    Falta Confirmar
                                  </span>
                                ) : sinpeConfirmado ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary shadow-sm">
                                    <span className="size-1 rounded-full bg-primary"></span>
                                    SINPE Confirmado
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ol>
              </div>
            </div>
          </div>
          <div className="hidden w-1/2 max-w-md flex-none border-l border-gray-100 px-8 py-10 md:block">
            <div className="flex items-center text-center text-gray-900">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Mes anterior</span>
                <ChevronLeftIcon aria-hidden="true" className="size-5" />
              </button>
              <div className="flex-auto text-sm font-semibold">
                {MONTHS_SPANISH[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Mes siguiente</span>
                <ChevronRightIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-7 text-center text-xs/6 text-gray-500">
              {DAYS_SHORT.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-gray-200 text-sm shadow-sm ring-1 ring-gray-200">
              {calendarDays.map((day, index) => {
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const isCurrentMonthDate = isCurrentMonth(day);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedDate(new Date(day))}
                    className={`py-1.5 ${
                      !isCurrentMonthDate
                        ? "bg-gray-50 text-gray-400"
                        : "bg-white text-gray-900 hover:bg-gray-100"
                    } ${isSelected ? "font-semibold text-white" : ""} ${
                      isTodayDate && !isSelected
                        ? "font-semibold text-primary"
                        : ""
                    } first:rounded-tl-lg last:rounded-br-lg focus:z-10 ${
                      index === 0 ? "rounded-tl-lg" : ""
                    } ${index === 6 ? "rounded-tr-lg" : ""} ${
                      index === calendarDays.length - 7 ? "rounded-bl-lg" : ""
                    } ${
                      index === calendarDays.length - 1 ? "rounded-br-lg" : ""
                    }`}
                  >
                    <time
                      dateTime={formatLocalDate(day)}
                      className={`mx-auto flex size-7 items-center justify-center rounded-full ${
                        isSelected
                          ? isTodayDate
                            ? "bg-primary"
                            : "bg-primary"
                          : isTodayDate
                          ? "bg-secondary/20"
                          : ""
                      }`}
                    >
                      {day.getDate()}
                    </time>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Drawer */}
      <ReservationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        reserva={selectedReserva}
        mode={drawerMode}
        onUpdate={handleUpdateReserva}
        onDelete={handleDeleteReserva}
        onConfirmSinpe={handleConfirmSinpe}
        onRefresh={fetchReservas}
        user={user}
      />

      {/* Create Reservation Drawer */}
      <CreateReservationDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        defaultCanchaId={selectedCanchaId}
        onSuccess={handleReservationCreated}
      />

      {/* Success Notification */}
      <SuccessNotification
        show={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
        message="Reserva creada"
        description="La reservación se ha creado exitosamente."
      />
    </AdminLayout>
  );
}
