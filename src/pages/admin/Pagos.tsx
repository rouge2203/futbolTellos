import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import PagoDrawer from "../../components/admin/PagoDrawer";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  FolderOpenIcon,
} from "@heroicons/react/20/solid";
import {
  Switch,
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { RiBankLine } from "react-icons/ri";
import { generateCierre } from "./utils/generateCierre";

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
  sinpe_pago: string | null;
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
  pago_checkeado?: boolean;
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
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [selectedCanchas, setSelectedCanchas] = useState<number[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [selectedPagoStatus, setSelectedPagoStatus] = useState<
    ("no_pagadas" | "incompletos" | "completos")[]
  >([]);

  // Cierres mode state
  const [cierresMode, setCierresMode] = useState(false);
  const [selectedPagoCheckeado, setSelectedPagoCheckeado] = useState<
    ("checkeados" | "no_checkeados")[]
  >([]);

  // Cierre dialog state
  const [cierreDialogOpen, setCierreDialogOpen] = useState(false);
  const [cierreNota, setCierreNota] = useState("");
  const [generatingCierre, setGeneratingCierre] = useState(false);

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

  // Fetch reservations with pagos
  const fetchReservas = async () => {
    // In cierres mode, use selectedDates; otherwise use selectedDate
    const datesToFetch = cierresMode
      ? selectedDates
      : selectedDate
      ? [selectedDate]
      : [];
    if (datesToFetch.length === 0) {
      setReservas([]);
      return;
    }

    setLoadingReservas(true);
    try {
      let allReservasData: any[] = [];

      // Fetch reservations for each selected date
      for (const date of datesToFetch) {
        const dateStr = formatLocalDate(date);
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
              pago_checkeado,
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
        allReservasData = [...allReservasData, ...(reservasData || [])];
      }

      // Filter by location if selected
      let filteredReservas: any[] = allReservasData;
      if (selectedLocations.length > 0) {
        filteredReservas = filteredReservas.filter(
          (r: any) => r.cancha && selectedLocations.includes(r.cancha.local)
        );
      }

      // Fetch pagos for all reservas
      const reservaIds = filteredReservas.map((r: any) => r.id);
      let pagosData: any[] = [];
      if (reservaIds.length > 0) {
        const { data, error: pagosError } = await supabase
          .from("pagos")
          .select("*")
          .in("reserva_id", reservaIds);

        if (pagosError) throw pagosError;
        pagosData = data || [];
      }

      // Group pagos by reserva_id
      const pagosByReserva: Record<number, Pago[]> = {};
      pagosData.forEach((pago: Pago) => {
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
          pago_checkeado: r.pago_checkeado || false,
        };
      });

      // Apply payment status filter
      let finalReservas = reservasConPagos;
      if (selectedPagoStatus.length > 0) {
        finalReservas = finalReservas.filter((r) => {
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

      // Apply pago_checkeado filter (only in cierres mode)
      if (cierresMode && selectedPagoCheckeado.length > 0) {
        finalReservas = finalReservas.filter((r) => {
          if (
            selectedPagoCheckeado.includes("checkeados") &&
            r.pago_checkeado
          ) {
            return true;
          }
          if (
            selectedPagoCheckeado.includes("no_checkeados") &&
            !r.pago_checkeado
          ) {
            return true;
          }
          return false;
        });
      }

      // Sort by hora_inicio
      finalReservas.sort(
        (a, b) =>
          new Date(a.hora_inicio).getTime() - new Date(b.hora_inicio).getTime()
      );

      setReservas(finalReservas);
    } catch (error) {
      console.error("Error fetching reservaciones:", error);
    } finally {
      setLoadingReservas(false);
    }
  };

  // Fetch reservations for selected date(s)
  useEffect(() => {
    fetchReservas();
  }, [
    selectedDate,
    selectedDates,
    selectedCanchas,
    selectedLocations,
    selectedPagoStatus,
    cierresMode,
    selectedPagoCheckeado,
  ]);

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
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${day} de ${month} de ${year} a las ${hour12}:${minutes} ${ampm}`;
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

  const togglePagoCheckeadoFilter = (
    status: "checkeados" | "no_checkeados"
  ) => {
    setSelectedPagoCheckeado((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleDateSelection = (date: Date) => {
    setSelectedDates((prev) => {
      const exists = prev.some((d) => isSameDay(d, date));
      if (exists) {
        return prev.filter((d) => !isSameDay(d, date));
      } else {
        return [...prev, date];
      }
    });
  };

  const isDateSelected = (date: Date): boolean => {
    return selectedDates.some((d) => isSameDay(d, date));
  };

  const handleVerPagos = (reserva: Reserva) => {
    setSelectedReserva(reserva);
    setDrawerOpen(true);
  };

  const handleReservaUpdated = async () => {
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
            pago_checkeado,
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
          pago_checkeado: data.pago_checkeado || false,
        });
      }
    }
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
      return {
        totalReservas: 0,
        totalPagos: 0,
        totalSinpe: 0,
        totalEfectivo: 0,
        diferencia: 0,
      };

    const totalReservas = reservas.reduce((sum, r) => sum + r.precio, 0);
    let totalPagos = 0;
    let totalSinpe = 0;
    let totalEfectivo = 0;

    reservas.forEach((r) => {
      (r.pagos || []).forEach((p) => {
        totalPagos += p.monto_sinpe + p.monto_efectivo;
        totalSinpe += p.monto_sinpe;
        totalEfectivo += p.monto_efectivo;
      });
    });

    return {
      totalReservas,
      totalPagos,
      totalSinpe,
      totalEfectivo,
      diferencia: totalReservas - totalPagos,
    };
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = MONTHS_SPANISH[currentMonth.getMonth()];
  const year = currentMonth.getFullYear();

  const formatDateRange = (): string => {
    if (cierresMode && selectedDates.length > 0) {
      const sortedDates = [...selectedDates].sort(
        (a, b) => a.getTime() - b.getTime()
      );
      if (sortedDates.length === 1) {
        const d = sortedDates[0];
        return `${d.getDate()} ${MONTHS_SPANISH[d.getMonth()]}`;
      }
      const first = sortedDates[0];
      const last = sortedDates[sortedDates.length - 1];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()}-${last.getDate()} ${
          MONTHS_SPANISH[first.getMonth()]
        }`;
      }
      return `${first.getDate()} ${
        MONTHS_SPANISH[first.getMonth()]
      } - ${last.getDate()} ${MONTHS_SPANISH[last.getMonth()]}`;
    }
    if (selectedDate) {
      return `${selectedDate.getDate()} ${
        MONTHS_SPANISH[selectedDate.getMonth()]
      }`;
    }
    return "";
  };

  const handleRegistrarCierre = async () => {
    if (!user || selectedDates.length === 0) return;

    setGeneratingCierre(true);
    setCierreDialogOpen(false);

    const result = await generateCierre({
      userId: user.id,
      userEmail: user.email || "Usuario",
      selectedDates,
      cierreNota,
      formatLocalDate,
    });

    if (result.success) {
      setCierreNota("");
      navigate("/admin/cierres", { state: { cierreCreated: true } });
    } else {
      alert(result.error || "Error al registrar el cierre.");
    }

    setGeneratingCierre(false);
  };

  // Get canchas for filter badges - sorted by location then id
  const sabanaCanchas = canchas
    .filter((c) => c.local === 1)
    .sort((a, b) => a.id - b.id);
  const guadalupeCanchas = canchas
    .filter((c) => c.local === 2)
    .sort((a, b) => a.id - b.id);
  const filterCanchas = [...sabanaCanchas, ...guadalupeCanchas];

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
        {/* Cierres Mode Toggle */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <RiBankLine className="size-5 text-primary" />
            <span className="text-sm font-medium text-gray-700">
              Modo Cierres
            </span>
            <Switch
              checked={cierresMode}
              onChange={(checked) => {
                setCierresMode(checked);
                if (checked) {
                  // Initialize with current selectedDate if any
                  if (selectedDate) {
                    setSelectedDates([selectedDate]);
                  }
                } else {
                  // Reset to single date mode
                  if (selectedDates.length > 0) {
                    setSelectedDate(selectedDates[0]);
                  }
                  setSelectedDates([]);
                  setSelectedPagoCheckeado([]);
                }
              }}
              className={`${
                cierresMode ? "bg-primary" : "bg-gray-200"
              } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
            >
              <span
                aria-hidden="true"
                className={`${
                  cierresMode ? "translate-x-5" : "translate-x-0"
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </Switch>
          </div>

          {/* Pago Checkeado Filters - Only in Cierres Mode, next to toggle */}
          {cierresMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => togglePagoCheckeadoFilter("checkeados")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                  selectedPagoCheckeado.includes("checkeados")
                    ? "bg-gray-700 text-white border-gray-700"
                    : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                <CheckBadgeIcon className="size-4" />
                Pagos checkeados
              </button>
              <button
                onClick={() => togglePagoCheckeadoFilter("no_checkeados")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                  selectedPagoCheckeado.includes("no_checkeados")
                    ? "bg-gray-700 text-white border-gray-700"
                    : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                <XCircleIcon className="size-4" />
                Pagos no checkeados
              </button>
            </div>
          )}

          {/* Cierre Actions - Only in Cierres Mode */}
          {cierresMode && (
            <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-auto">
              <button
                onClick={() => navigate("/admin/cierres")}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                <FolderOpenIcon className="size-4" />
                Ver Cierres
              </button>
              <button
                onClick={() => {
                  if (selectedDates.length === 0) {
                    alert(
                      "Seleccione al menos una fecha para registrar el cierre"
                    );
                    return;
                  }
                  setCierreDialogOpen(true);
                }}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 bg-primary text-white hover:bg-primary/90"
              >
                <ClipboardDocumentCheckIcon className="size-4" />
                Registrar Cierre
              </button>
            </div>
          )}
        </div>

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
                const isSelected = cierresMode
                  ? isDateSelected(day)
                  : isSameDay(selectedDate, day);
                const isTodayDate = isToday(day);
                const isCurrentMonthDate = isCurrentMonth(day);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      if (cierresMode) {
                        toggleDateSelection(new Date(day));
                      } else {
                        setSelectedDate(new Date(day));
                      }
                    }}
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
            {(selectedDate || (cierresMode && selectedDates.length > 0)) && (
              <div className="mt-6 rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {cierresMode && selectedDates.length > 1
                    ? `Totales (${formatDateRange()})`
                    : "Totales del día"}
                </h3>

                {cierresMode ? (
                  /* Full Totals in Cierres Mode */
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Total reservaciones:
                      </span>
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
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex text-xs items-center gap-1.5">
                        <DocumentTextIcon className="size-3 text-gray-500" />
                        SINPE:
                      </span>
                      <span className="font-medium text-gray-900 text-xs">
                        ₡ {totals.totalSinpe.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex text-xs items-center gap-1.5">
                        <BanknotesIcon className="size-3 text-gray-500" />
                        Efectivo:
                      </span>
                      <span className="font-medium text-xs text-gray-900">
                        ₡ {totals.totalEfectivo.toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 flex justify-between">
                      <span className="text-gray-900 font-semibold">
                        Faltante:
                      </span>
                      <span
                        className={`font-bold ${
                          totals.diferencia > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        ₡ {totals.diferencia.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Normal Mode - Only Faltante + Info Message */
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-semibold">
                        Faltante:
                      </span>
                      <span
                        className={`font-bold ${
                          totals.diferencia > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        ₡ {totals.diferencia.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 text-start">
                        El objetivo es registrar pagos hasta que el faltante sea
                        ₡ 0.
                      </p>
                    </div>
                  </div>
                )}
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
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  selectedLocations.includes(1)
                    ? "bg-green-800 text-white"
                    : "bg-gray-200 text-green-800 hover:bg-gray-300"
                }`}
              >
                Sabana
              </button>
              <button
                onClick={() => toggleLocationFilter(2)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  selectedLocations.includes(2)
                    ? "bg-blue-800 text-white"
                    : "bg-gray-200 text-blue-800 hover:bg-gray-300"
                }`}
              >
                Guadalupe
              </button>
              {/* Cancha filters */}
              {filterCanchas.map((cancha) => {
                const isSabana = cancha.local === 1;
                return (
                  <button
                    key={cancha.id}
                    onClick={() => toggleCanchaFilter(cancha.id)}
                    className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      selectedCanchas.includes(cancha.id)
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
              {/* Payment status filters */}
              <button
                onClick={() => togglePagoStatusFilter("no_pagadas")}
                className={`rounded-md px-3 py-2 border border-red-200 text-xs font-medium transition-colors ${
                  selectedPagoStatus.includes("no_pagadas")
                    ? "bg-red-400 text-white"
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                Sin pago registrado
              </button>
              <button
                onClick={() => togglePagoStatusFilter("incompletos")}
                className={`rounded-md px-3 py-2 border border-yellow-200  text-xs font-medium transition-colors ${
                  selectedPagoStatus.includes("incompletos")
                    ? "bg-yellow-500 text-white"
                    : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                }`}
              >
                Pagos incompletos
              </button>
              <button
                onClick={() => togglePagoStatusFilter("completos")}
                className={`rounded-md px-3 py-2 border border-green-200 text-green-600 text-xs font-medium transition-colors ${
                  selectedPagoStatus.includes("completos")
                    ? "bg-green-600 text-white"
                    : "bg-green-50 text-primary hover:bg-green-100"
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
                  ? "No hay reservaciones para esta fecha"
                  : "Selecciona una fecha para ver las reservaciones"}
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
                          Pago incompleto
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm">
                          <span className="size-1.5 rounded-full bg-red-500"></span>
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
                        <dl className="mt-2 flex flex-col text-gray-500 xl:flex-row xl:items-center">
                          <div className="flex items-center gap-x-2">
                            <CalendarIcon
                              aria-hidden="true"
                              className="size-4 text-gray-400"
                            />
                            <time
                              dateTime={reserva.hora_inicio}
                              className="text-sm"
                            >
                              {formatDateTime(reserva.hora_inicio)}
                            </time>
                            <span className="text-gray-300">•</span>
                            <MapPinIcon
                              aria-hidden="true"
                              className="size-4 text-gray-400"
                            />
                            <span className="text-sm">
                              {reserva.cancha.nombre} -{" "}
                              {getLocalName(reserva.cancha.local)}
                            </span>
                          </div>
                          <div className="mt-1 xl:mt-0 xl:ml-3.5 xl:border-l xl:border-gray-400/50 xl:pl-3.5">
                            <span className="font-semibold text-gray-900">
                              ₡ {reserva.precio.toLocaleString()}
                            </span>
                          </div>
                        </dl>
                        {/* Payment Status */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getPagoBadge()}
                          {/* Pago Checkeado Badge - Only in Cierres Mode */}
                          {cierresMode &&
                            (reserva.pago_checkeado ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm">
                                <CheckBadgeIcon className="size-4 text-gray-600" />
                                Pago checkeado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 shadow-sm">
                                <XCircleIcon className="size-4 text-gray-400" />
                                Pago no checkeado
                              </span>
                            ))}
                        </div>
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
        cierresMode={cierresMode}
        onReservaUpdated={handleReservaUpdated}
      />

      {/* Cierre Confirmation Dialog */}
      <Dialog
        open={cierreDialogOpen}
        onClose={() => setCierreDialogOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all data-closed:opacity-0 data-closed:scale-95 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in max-w-md w-full"
            >
              <div className="bg-primary px-4 py-3 flex items-center gap-2">
                <ClipboardDocumentCheckIcon className="size-5 text-white" />
                <DialogTitle className="text-base font-semibold text-white">
                  Registrar Cierre
                </DialogTitle>
              </div>
              <div className="p-4 space-y-4">
                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Resumen del Cierre
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Fechas seleccionadas:
                      </span>
                      <span className="font-medium text-gray-900">
                        {selectedDates.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Periodo:</span>
                      <span className="font-medium text-gray-900">
                        {formatDateRange()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Total reservaciones:
                      </span>
                      <span className="font-medium text-gray-900">
                        ₡ {totals.totalReservas.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total pagos:</span>
                      <span className="font-medium text-gray-900">
                        ₡ {totals.totalPagos.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-1.5">
                      <span className="font-semibold text-gray-900">
                        Faltante:
                      </span>
                      <span
                        className={`font-bold ${
                          totals.diferencia > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        ₡ {totals.diferencia.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nota input */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Nota (opcional)
                  </label>
                  <textarea
                    value={cierreNota}
                    onChange={(e) => setCierreNota(e.target.value)}
                    placeholder="Agregar nota al cierre..."
                    rows={2}
                    className="block w-full rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  />
                </div>

                {/* Info message */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-700 font-medium">
                    Se generará un PDF con toda la información del cierre,
                    incluyendo totales por día y reservas con pendientes.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCierreDialogOpen(false);
                    setCierreNota("");
                  }}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRegistrarCierre}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                >
                  Registrar Cierre
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Full-screen Loader for Cierre Generation */}
      {generatingCierre && (
        <div className="fixed inset-0 z-100 bg-black/80 flex flex-col items-center justify-center">
          <img
            src="/tellos-square.svg"
            alt="Futbol Tello"
            className="w-16 h-16 animate-spin"
          />
          <p className="mt-4 text-white text-lg font-semibold">Futbol Tello</p>
          <p className="mt-2 text-white/70 text-sm">Generando cierre...</p>
        </div>
      )}
    </AdminLayout>
  );
}
