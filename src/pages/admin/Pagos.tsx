import { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import PagoDrawer from "../../components/admin/PagoDrawer";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
} from "@heroicons/react/20/solid";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  local: number;
  cantidad?: string;
  precio?: string;
}

interface Pago {
  id: number;
  reserva_id: number;
  monto_sinpe: number;
  monto_efectivo: number;
  nota: string | null;
  completo: boolean;
  creado_por: string;
  created_at?: string;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  correo_reserva: string;
  precio: number;
  arbitro: boolean;
  cancha: Cancha;
  pagos?: Pago[];
  pagoStatus?: "no_registrado" | "incompleto" | "completo";
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

export default function Pagos() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [selectedCanchas, setSelectedCanchas] = useState<number[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [selectedPagoStatus, setSelectedPagoStatus] = useState<
    ("no_pagadas" | "incompletos" | "completos")[]
  >([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Fetch reservations with pagos
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

      const { data: reservasData, error: reservasError } = await query;

      if (reservasError) throw reservasError;

      // Filter by location if selected
      let filteredReservas: any[] = reservasData || [];
      if (selectedLocations.length > 0) {
        filteredReservas = filteredReservas.filter(
          (r: any) => r.cancha && selectedLocations.includes(r.cancha.local)
        );
      }

      // Fetch pagos for all reservas
      const reservaIds = filteredReservas.map((r: any) => r.id);
      const { data: pagosData, error: pagosError } = await supabase
        .from("pagos")
        .select("*")
        .in("reserva_id", reservaIds);

      if (pagosError) throw pagosError;

      // Group pagos by reserva_id
      const pagosByReserva: Record<number, Pago[]> = {};
      (pagosData || []).forEach((pago: Pago) => {
        if (!pagosByReserva[pago.reserva_id]) {
          pagosByReserva[pago.reserva_id] = [];
        }
        pagosByReserva[pago.reserva_id].push(pago);
      });

      // Combine reservas with pagos and determine status
      const reservasConPagos: Reserva[] = filteredReservas.map((r: any) => {
        const pagos = pagosByReserva[r.id] || [];
        let pagoStatus: "no_registrado" | "incompleto" | "completo" =
          "no_registrado";

        if (pagos.length > 0) {
          const hasCompleto = pagos.some((p: Pago) => p.completo === true);
          pagoStatus = hasCompleto ? "completo" : "incompleto";
        }

        return {
          ...r,
          cancha: Array.isArray(r.cancha) ? r.cancha[0] : r.cancha,
          pagos,
          pagoStatus,
        };
      });

      // Apply payment status filter
      let finalReservas = reservasConPagos;
      if (selectedPagoStatus.length > 0) {
        finalReservas = reservasConPagos.filter((r) => {
          const statusMap: Record<
            "no_pagadas" | "incompletos" | "completos",
            "no_registrado" | "incompleto" | "completo"
          > = {
            no_pagadas: "no_registrado",
            incompletos: "incompleto",
            completos: "completo",
          };
          return selectedPagoStatus.some(
            (filterStatus) => r.pagoStatus === statusMap[filterStatus]
          );
        });
      }

      setReservas(finalReservas);
    } catch (error) {
      console.error("Error fetching reservas:", error);
    } finally {
      setLoadingReservas(false);
    }
  };

  // Fetch reservations for selected date
  useEffect(() => {
    fetchReservas();
  }, [selectedDate, selectedCanchas, selectedLocations, selectedPagoStatus]);

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

  const togglePagoStatusFilter = (
    status: "no_pagadas" | "incompletos" | "completos"
  ) => {
    setSelectedPagoStatus((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleVerPagos = (reserva: Reserva) => {
    setSelectedReserva(reserva);
    setDrawerOpen(true);
  };

  const handlePagoCreated = async () => {
    await fetchReservas();
    if (selectedReserva) {
      // Refresh selected reserva data
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
        .eq("id", selectedReserva.id)
        .single();

      if (!error && data) {
        const { data: pagosData } = await supabase
          .from("pagos")
          .select("*")
          .eq("reserva_id", selectedReserva.id);

        const pagos = pagosData || [];
        let pagoStatus: "no_registrado" | "incompleto" | "completo" =
          "no_registrado";

        if (pagos.length > 0) {
          const hasCompleto = pagos.some((p: Pago) => p.completo === true);
          pagoStatus = hasCompleto ? "completo" : "incompleto";
        }

        setSelectedReserva({
          ...data,
          cancha: Array.isArray(data.cancha) ? data.cancha[0] : data.cancha,
          pagos,
          pagoStatus,
        });
      }
    }
  };

  // Calculate daily totals
  const calculateDailyTotals = () => {
    if (!selectedDate)
      return { totalReservas: 0, totalPagos: 0, diferencia: 0 };

    const totalReservas = reservas.reduce((sum, r) => sum + r.precio, 0);
    const totalPagos = reservas.reduce((sum, r) => {
      const pagosTotal = (r.pagos || []).reduce(
        (pSum, p) => pSum + p.monto_sinpe + p.monto_efectivo,
        0
      );
      return sum + pagosTotal;
    }, 0);

    return {
      totalReservas,
      totalPagos,
      diferencia: totalReservas - totalPagos,
    };
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = MONTHS_SPANISH[currentMonth.getMonth()];
  const year = currentMonth.getFullYear();

  // Get canchas for filter badges
  const cancha6 = canchas.find((c) => c.id === 6);
  const otherCanchas = canchas.filter((c) => c.id !== 6).slice(0, 5);
  const filterCanchas = cancha6
    ? [...otherCanchas, cancha6]
    : canchas.slice(0, 5);

  const totals = calculateDailyTotals();

  if (loading) {
    return (
      <AdminLayout title="Pagos">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Pagos">
      <div className="min-h-screen">
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

            {/* Daily Totals */}
            {selectedDate && (
              <div className="mt-6 rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Totales del día
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Reservas:</span>
                    <span className="font-medium text-gray-900">
                      ₡ {totals.totalReservas.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Pagos:</span>
                    <span className="font-medium text-gray-900">
                      ₡ {totals.totalPagos.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between">
                    <span className="text-gray-900 font-semibold">
                      Diferencia:
                    </span>
                    <span
                      className={`font-bold ${
                        totals.diferencia >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      ₡ {totals.diferencia.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
              {/* Payment status filters */}
              <button
                onClick={() => togglePagoStatusFilter("no_pagadas")}
                className={`rounded-md px-3 py-1 border border-gray-300 text-xs font-medium transition-colors ${
                  selectedPagoStatus.includes("no_pagadas")
                    ? "bg-gray-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                No pagadas
              </button>
              <button
                onClick={() => togglePagoStatusFilter("incompletos")}
                className={`rounded-md px-3 py-1 border border-yellow-300 text-xs font-medium transition-colors ${
                  selectedPagoStatus.includes("incompletos")
                    ? "bg-yellow-500 text-white"
                    : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                }`}
              >
                Pagos incompletos
              </button>
              <button
                onClick={() => togglePagoStatusFilter("completos")}
                className={`rounded-md px-3 py-1 border border-green-300 text-xs font-medium transition-colors ${
                  selectedPagoStatus.includes("completos")
                    ? "bg-green-500 text-white"
                    : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                Pagos completos
              </button>
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
                  const getPagoBadge = () => {
                    if (reserva.pagoStatus === "completo") {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-800 shadow-sm">
                          <span className="size-1.5 rounded-full bg-green-500"></span>
                          Pago registrado
                        </span>
                      );
                    } else if (reserva.pagoStatus === "incompleto") {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-1.5 text-xs font-semibold text-yellow-800 shadow-sm">
                          <span className="size-1.5 rounded-full bg-yellow-500"></span>
                          Pago no completo
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm">
                          <span className="size-1.5 rounded-full bg-gray-500"></span>
                          Pago no registrado
                        </span>
                      );
                    }
                  };

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
                          <div className="mt-2 flex items-start gap-x-3 xl:mt-0 xl:ml-3.5 xl:border-l xl:border-gray-400/50 xl:pl-3.5">
                            <dt className="mt-0.5">
                              <span className="sr-only">Precio</span>
                            </dt>
                            <dd className="font-semibold text-gray-900">
                              ₡ {reserva.precio.toLocaleString()}
                            </dd>
                          </div>
                        </dl>
                        {/* Payment Status */}
                        <div className="mt-2">{getPagoBadge()}</div>
                      </div>
                      <div className="flex items-center">
                        <button
                          onClick={() => handleVerPagos(reserva)}
                          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {reserva.pagos && reserva.pagos.length > 0
                            ? "Ver pagos"
                            : "Registrar pago"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Pago Drawer */}
      <PagoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        reserva={selectedReserva}
        onPagoCreated={handlePagoCreated}
        user={user}
      />
    </AdminLayout>
  );
}
