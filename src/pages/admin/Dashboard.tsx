import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import ReservationDrawer from "../../components/admin/ReservationDrawer";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  MapPinIcon,
} from "@heroicons/react/20/solid";
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

export default function Dashboard() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [selectedCanchas, setSelectedCanchas] = useState<number[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "cancel">("edit");
  const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);

  // Fetch canchas for filters
  useEffect(() => {
    const fetchCanchas = async () => {
      try {
        const { data, error } = await supabase
          .from("canchas")
          .select("id, nombre, img, local")
          .order("id");

        if (error) throw error;
        setCanchas(data || []);
      } catch (error) {
        console.error("Error fetching canchas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCanchas();
  }, []);

  // Fetch reservations function (can be called to refresh)
  const fetchReservas = async () => {
    if (!selectedDate) return;

    setLoadingReservas(true);
    try {
      const dateStr = formatLocalDate(selectedDate);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      let query = supabase
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
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay)
        .order("hora_inicio", { ascending: true });

      // Apply filters
      if (selectedCanchas.length > 0) {
        query = query.in("cancha_id", selectedCanchas);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredReservas: Reserva[] = (data || []).map((r: any) => ({
        ...r,
        cancha: Array.isArray(r.cancha) ? r.cancha[0] : r.cancha,
      }));

      // Filter by location if selected
      if (selectedLocations.length > 0) {
        filteredReservas = filteredReservas.filter(
          (r) => r.cancha && selectedLocations.includes(r.cancha.local)
        );
      }

      setReservas(filteredReservas);
    } catch (error) {
      console.error("Error fetching reservas:", error);
    } finally {
      setLoadingReservas(false);
    }
  };

  // Fetch reservations for selected date
  useEffect(() => {
    fetchReservas();
  }, [selectedDate, selectedCanchas, selectedLocations]);

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

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  const formatDateTime = (timestamp: string): string => {
    const date = parseDateFromTimestamp(timestamp);
    const day = date.getDate();
    const month = MONTHS_SPANISH[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day} de ${month} de ${year} a las ${hours}:${minutes}`;
  };

  // Calendar generation
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add days from previous month to fill first week
    const startDay = firstDay.getDay();
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1; // Monday = 0
    for (let i = adjustedStartDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // Add days from next month to fill last week
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  };

  const isSameDay = (date1: Date | null, date2: Date): boolean => {
    if (!date1) return false;
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

  const toggleCanchaFilter = (canchaId: number) => {
    setSelectedCanchas((prev) =>
      prev.includes(canchaId)
        ? prev.filter((id) => id !== canchaId)
        : [...prev, canchaId]
    );
  };

  const toggleLocationFilter = (location: number) => {
    setSelectedLocations((prev) =>
      prev.includes(location)
        ? prev.filter((loc) => loc !== location)
        : [...prev, location]
    );
  };

  // Fetch full reservation details
  const fetchReservaDetails = async (reservaId: number) => {
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
      setDrawerOpen(true);
    } catch (error) {
      console.error("Error fetching reserva details:", error);
    }
  };

  const handleConfirmarSinpe = async (reservaId: number) => {
    setDrawerMode("edit");
    await fetchReservaDetails(reservaId);
  };

  const handleVerReservacion = async (reservaId: number) => {
    setDrawerMode("edit");
    await fetchReservaDetails(reservaId);
  };

  const handleCancelarReservacion = async (reservaId: number) => {
    setDrawerMode("cancel");
    await fetchReservaDetails(reservaId);
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

      // Perform the update
      const { data: updateResult, error: updateError } = await supabase
        .from("reservas")
        .update(updateData)
        .eq("id", selectedReserva.id)
        .select("id")
        .single();

      if (updateError) {
        throw updateError;
      }

      if (!updateResult) {
        throw new Error(
          "Update returned no data - RLS policy may be blocking the update"
        );
      }

      // Verify the update worked by fetching the updated row
      const { data: verifyData, error: verifyError } = await supabase
        .from("reservas")
        .select(
          "id, nombre_reserva, celular_reserva, correo_reserva, precio, hora_inicio, hora_fin"
        )
        .eq("id", selectedReserva.id)
        .single();

      if (verifyError) {
        throw verifyError;
      }

      // Check if values actually changed
      if (
        verifyData.nombre_reserva !== updates.nombre_reserva ||
        verifyData.celular_reserva !== updates.celular_reserva ||
        verifyData.correo_reserva !== updates.correo_reserva ||
        verifyData.precio !== updates.precio
      ) {
        throw new Error(
          "Update failed: RLS policy may be blocking the update. Please check your Supabase RLS policies."
        );
      }

      // Refresh the selected reservation data in the drawer
      await fetchReservaDetails(selectedReserva.id);
    } catch (error) {
      console.error("Error updating reserva:", error);
      throw error;
    }
  };

  const handleConfirmSinpe = async (
    reservaId: number,
    _hasComprobante: boolean
  ) => {
    if (!user) {
      console.error("No user found when trying to confirm SINPE");
      return;
    }

    try {
      // Build update data with confirmada and confirmada_por (using email)
      const updateData: any = {
        confirmada: true,
        confirmada_por: user.email || user.id,
      };

      console.log("Confirming SINPE with admin email:", user.email);

      const { data, error } = await supabase
        .from("reservas")
        .update(updateData)
        .eq("id", reservaId)
        .select("id, confirmada, confirmada_por")
        .single();

      if (error) {
        console.error("Error updating reservation:", error);

        // If error is about confirmada_por column not existing, try without it
        if (
          error.message?.includes("confirmada_por") ||
          error.code === "42703"
        ) {
          console.warn(
            "confirmada_por column may not exist, retrying without it"
          );
          const { error: retryError } = await supabase
            .from("reservas")
            .update({ confirmada: true })
            .eq("id", reservaId);

          if (retryError) throw retryError;
        } else {
          throw error;
        }
      } else {
        console.log("SINPE confirmation successful:", data);
      }

      // Refresh reservation details
      await fetchReservaDetails(reservaId);
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
    } catch (error) {
      console.error("Error deleting reserva:", error);
      throw error;
    }
  };

  const handleCrearReservacion = () => {
    // TODO: Implement crear reservacion
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = MONTHS_SPANISH[currentMonth.getMonth()];
  const year = currentMonth.getFullYear();

  // Get canchas for filter badges - ensure cancha id 6 is included
  const cancha6 = canchas.find((c) => c.id === 6);
  const otherCanchas = canchas.filter((c) => c.id !== 6).slice(0, 5);
  const filterCanchas = cancha6
    ? [...otherCanchas, cancha6]
    : canchas.slice(0, 5);

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Reservaciones">
      <div className="min-h-screen">
        {/* <h2 className="text-base font-semibold text-gray-900 mb-6">
          Reserva del día
        </h2> */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-16">
          {/* Calendar */}
          <div className="mt-10 text-center lg:col-start-8 lg:col-end-13 lg:row-start-1 lg:mt-9 xl:col-start-9">
            <div className="flex items-center text-gray-900">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="-m-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Mes anterior</span>
                <ChevronLeftIcon aria-hidden="true" className="size-5" />
              </button>
              <div className="flex-auto text-sm font-semibold">
                {monthName} {year}
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
            <div className="mt-6 grid grid-cols-7 text-xs/6 text-gray-500">
              {DAYS_SHORT.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-gray-200 text-sm shadow-sm ring-1 ring-gray-200">
              {days.map((day, index) => {
                const isSelected = isSameDay(selectedDate, day);
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
                      index === days.length - 7 ? "rounded-bl-lg" : ""
                    } ${index === days.length - 1 ? "rounded-br-lg" : ""}`}
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
            <button
              type="button"
              onClick={handleCrearReservacion}
              className="mt-8 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Crear reservación
            </button>
          </div>

          {/* Reservations List */}
          <div className="mt-4 lg:col-span-7 xl:col-span-8">
            {/* Filter Badges */}
            <div className="mb-6 flex flex-wrap gap-2">
              {/* Location filters */}
              <button
                onClick={() => toggleLocationFilter(1)}
                className={`rounded-md px-3 py-1 border border-gray-300 text-xs font-medium transition-colors ${
                  selectedLocations.includes(1)
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Sabana
              </button>
              <button
                onClick={() => toggleLocationFilter(2)}
                className={`rounded-md px-3 py-1 border border-gray-300 text-xs font-medium transition-colors ${
                  selectedLocations.includes(2)
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Guadalupe
              </button>
              {/* Cancha filters */}
              {filterCanchas.map((cancha) => (
                <button
                  key={cancha.id}
                  onClick={() => toggleCanchaFilter(cancha.id)}
                  className={`rounded-md px-3 border border-gray-300 py-1 text-xs font-medium transition-colors ${
                    selectedCanchas.includes(cancha.id)
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cancha.nombre}
                </button>
              ))}
            </div>

            {/* Reservations List */}
            {loadingReservas ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : reservas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {selectedDate
                  ? "No hay reservas para esta fecha"
                  : "Selecciona una fecha para ver las reservas"}
              </div>
            ) : (
              <ol className="divide-y divide-gray-100 text-sm/6">
                {reservas.map((reserva) => {
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

                  return (
                    <li
                      key={reserva.id}
                      className="relative flex gap-x-6 py-6 xl:static"
                    >
                      <img
                        alt={reserva.cancha.nombre}
                        src={reserva.cancha.img}
                        className="size-14 flex-none rounded-full object-cover"
                      />
                      <div className="flex-auto">
                        <h3 className="pr-10 font-semibold text-gray-900 xl:pr-0">
                          {reserva.nombre_reserva}
                        </h3>
                        <dl className="mt-2 flex flex-col text-gray-500 xl:flex-row">
                          <div className="flex items-start gap-x-3">
                            <dt className="mt-0.5">
                              <span className="sr-only">Fecha</span>
                              <CalendarIcon
                                aria-hidden="true"
                                className="size-5 text-gray-400"
                              />
                            </dt>
                            <dd>
                              <time dateTime={reserva.hora_inicio}>
                                {formatDateTime(reserva.hora_inicio)}
                              </time>
                            </dd>
                          </div>
                          <div className="mt-2 flex items-start gap-x-3 xl:mt-0 xl:ml-3.5 xl:border-l xl:border-gray-400/50 xl:pl-3.5">
                            <dt className="mt-0.5">
                              <span className="sr-only">Ubicación</span>
                              <MapPinIcon
                                aria-hidden="true"
                                className="size-5 text-gray-400"
                              />
                            </dt>
                            <dd>
                              {reserva.cancha.nombre} -{" "}
                              {getLocalName(reserva.cancha.local)}
                            </dd>
                          </div>
                        </dl>
                        {/* SINPE Status */}
                        {isSabana && (
                          <div className="mt-2">
                            {sinpePendiente ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-1.5 text-xs font-semibold text-yellow-800 shadow-sm">
                                <span className="size-1.5 rounded-full bg-yellow-500"></span>
                                SINPE Pendiente
                              </span>
                            ) : sinpeFaltaConfirmar ? (
                              <button
                                onClick={() => handleConfirmarSinpe(reserva.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
                              >
                                Falta Confirmar Sinpe
                              </button>
                            ) : sinpeConfirmado ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
                                <span className="size-1.5 rounded-full bg-primary"></span>
                                SINPE Confirmado
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <Menu
                        as="div"
                        className="absolute top-6 right-0 xl:relative xl:top-auto xl:right-auto xl:self-center"
                      >
                        <MenuButton className="relative flex items-center rounded-full text-gray-500 hover:text-gray-600">
                          <span className="absolute -inset-2" />
                          <span className="sr-only">Abrir opciones</span>
                          <EllipsisHorizontalIcon
                            aria-hidden="true"
                            className="size-5"
                          />
                        </MenuButton>

                        <MenuItems
                          transition
                          className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                        >
                          <div className="py-1">
                            {sinpeFaltaConfirmar && (
                              <MenuItem>
                                <button
                                  onClick={() =>
                                    handleConfirmarSinpe(reserva.id)
                                  }
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden"
                                >
                                  Confirmar SINPE
                                </button>
                              </MenuItem>
                            )}
                            <MenuItem>
                              <button
                                onClick={() => handleVerReservacion(reserva.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden"
                              >
                                Ver reservación
                              </button>
                            </MenuItem>
                            <MenuItem>
                              <button
                                onClick={() =>
                                  handleCancelarReservacion(reserva.id)
                                }
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden"
                              >
                                Cancelar reservación
                              </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Menu>
                    </li>
                  );
                })}
              </ol>
            )}
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
    </AdminLayout>
  );
}
