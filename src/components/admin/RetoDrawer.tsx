import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogBackdrop,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  PencilSquareIcon,
  ChevronDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/20/solid";
import { FaRegCalendarCheck, FaRegClock } from "react-icons/fa";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { GiWhistle } from "react-icons/gi";

interface Cancha {
  id: number;
  nombre: string;
  img?: string;
  local: number;
  cantidad?: string;
  precio?: string;
}

interface Reto {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  local: string;
  fut: number;
  arbitro: boolean;
  equipo1_nombre: string | null;
  equipo1_encargado: string;
  equipo1_celular: string;
  equipo1_correo: string | null;
  equipo2_nombre: string | null;
  equipo2_encargado: string | null;
  equipo2_celular: string | null;
  cancha_id: number;
  reserva_id: number | null;
  cancha?: Cancha;
}

interface Configuracion {
  apertura_guada: string;
  apertura_sabana: string;
  cierre_sabana: string;
  cierre_guada: string;
}

interface RetoDrawerProps {
  open: boolean;
  onClose: () => void;
  reto: Reto | null;
  mode: "assign" | "view";
  onReservaCreated: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onDelete?: (retoId: number) => Promise<void>;
  user: User | null;
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

const DAYS_SPANISH = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const LINKED_CANCHAS = [1, 3, 5];

export default function RetoDrawer({
  open,
  onClose,
  reto,
  mode,
  onReservaCreated,
  onRefresh,
  onDelete,
}: RetoDrawerProps) {
  const navigate = useNavigate();
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(
    null
  );
  const [canchas, setCanchas] = useState<Cancha[]>([]);

  // Form state for editing
  const [editCanchaId, setEditCanchaId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editHour, setEditHour] = useState<number | null>(null);
  const [editFut, setEditFut] = useState<number | null>(null);
  const [editArbitro, setEditArbitro] = useState<boolean>(false);
  const [equipo2Nombre, setEquipo2Nombre] = useState<string>("");
  const [equipo2Encargado, setEquipo2Encargado] = useState<string>("");
  const [equipo2Celular, setEquipo2Celular] = useState<string>("");

  const [availableHours, setAvailableHours] = useState<number[]>([]);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [showHourSelector, setShowHourSelector] = useState(false);
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [showCanchaSelector, setShowCanchaSelector] = useState(false);
  const [showFutEdit, setShowFutEdit] = useState(false);

  // Confirmation dialogs
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Generate dates for today + 10 days
  const dates = Array.from({ length: 11 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  // Fetch configuracion and canchas
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configResult, canchasResult] = await Promise.all([
          supabase.from("configuracion").select("*").limit(1).single(),
          supabase
            .from("canchas")
            .select("id, nombre, img, local, cantidad, precio")
            .order("id"),
        ]);

        if (configResult.error) throw configResult.error;
        if (canchasResult.error) throw canchasResult.error;

        setConfiguracion(configResult.data);
        setCanchas(canchasResult.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Initialize form when reto changes
  useEffect(() => {
    if (reto) {
      setEditCanchaId(reto.cancha_id);
      setEditFut(reto.fut);
      // Only set arbitro if cancha is Guadalupe (local == 2)
      const retoCancha = canchas.find((c) => c.id === reto.cancha_id);
      setEditArbitro(retoCancha?.local === 2 ? reto.arbitro : false);
      setEquipo2Nombre(reto.equipo2_nombre || "");
      setEquipo2Encargado(reto.equipo2_encargado || "");
      setEquipo2Celular(reto.equipo2_celular || "");

      const date = parseDateFromTimestamp(reto.hora_inicio);
      setEditDate(date);
      const hour = parseHourFromTimestamp(reto.hora_inicio);
      setEditHour(hour);

      setShowHourSelector(false);
      setShowDateSelector(false);
      setShowCanchaSelector(false);
      setShowFutEdit(false);
    }
  }, [reto]);

  // Calculate total price based on cancha, FUT, and arbitro
  const calculateTotalPrice = (): number => {
    if (!editCanchaId || !editFut) return 0;

    const currentCancha = canchas.find((c) => c.id === editCanchaId);
    if (!currentCancha) return 0;

    let basePrice: number;

    // Special handling for cancha.id === 6
    if (currentCancha.id === 6) {
      if (editFut === 6) {
        basePrice = 40000;
      } else if (editFut === 7) {
        basePrice = 45000;
      } else if (editFut === 8) {
        basePrice = 50000;
      } else {
        basePrice = 40000; // default
      }
    } else {
      // For other canchas, use precio from database
      const precioStr = currentCancha.precio || "0";
      basePrice = parseInt(precioStr.replace(/\./g, ""), 10) || 0;
    }

    // Add arbitro cost (5000 total) - Only for Guadalupe (local == 2)
    const arbitroCost = currentCancha.local === 2 && editArbitro ? 5000 : 0;
    const totalPrice = basePrice + arbitroCost;
    return totalPrice;
  };

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

  const parseHourFromTimestamp = (timestamp: string): number => {
    const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    return new Date(timestamp).getHours();
  };

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  // Calculate available hours when date/cancha changes
  useEffect(() => {
    if (!reto || !configuracion || !editDate || !editCanchaId) return;

    const calculateAvailableHours = async () => {
      const currentCancha = canchas.find((c) => c.id === editCanchaId);
      if (!currentCancha) return;

      const aperturaStr =
        currentCancha.local === 1
          ? configuracion.apertura_sabana
          : configuracion.apertura_guada;
      const cierreStr =
        currentCancha.local === 1
          ? configuracion.cierre_sabana
          : configuracion.cierre_guada;

      const parseTimeToHour = (timeStr: string): number => {
        return parseInt(timeStr.split(":")[0], 10);
      };

      const apertura = parseTimeToHour(aperturaStr);
      let cierre = parseTimeToHour(cierreStr);

      if (cierre <= apertura) {
        cierre = cierre + 24;
      }

      const hours: number[] = [];
      for (let h = apertura; h < cierre; h++) {
        const displayHour = h < 24 ? h : h - 24;
        hours.push(displayHour);
      }

      // Check if date is today
      const today = new Date();
      const isTodayDate =
        editDate.getDate() === today.getDate() &&
        editDate.getMonth() === today.getMonth() &&
        editDate.getFullYear() === today.getFullYear();

      if (isTodayDate) {
        const getCurrentHourCR = (): number => {
          const now = new Date();
          const crTime = new Date(
            now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
          );
          return crTime.getHours();
        };
        const currentHour = getCurrentHourCR();
        const filteredHours = hours.filter((h) => h > currentHour);
        setAvailableHours(filteredHours);
      } else {
        setAvailableHours(hours);
      }

      // Fetch reserved hours from reservas AND closed retos
      const dateStr = formatLocalDate(editDate);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      let canchaIds: number[];
      if (editCanchaId === 6) {
        canchaIds = [6, ...LINKED_CANCHAS];
      } else if (LINKED_CANCHAS.includes(editCanchaId)) {
        canchaIds = [editCanchaId, 6];
      } else {
        canchaIds = [editCanchaId];
      }

      // Check reservas
      const { data: reservasData } = await supabase
        .from("reservas")
        .select("hora_inicio")
        .in("cancha_id", canchaIds)
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay);

      // Check closed retos (retos with reserva_id)
      const { data: retosData } = await supabase
        .from("retos")
        .select("hora_inicio")
        .not("reserva_id", "is", null)
        .in("cancha_id", canchaIds)
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay)
        .neq("id", reto.id); // Exclude current reto

      const reservedFromReservas = (reservasData || []).map((r) =>
        parseHourFromTimestamp(r.hora_inicio)
      );
      const reservedFromRetos = (retosData || []).map((r) =>
        parseHourFromTimestamp(r.hora_inicio)
      );

      // Combine and deduplicate
      const allReserved = [
        ...new Set([...reservedFromReservas, ...reservedFromRetos]),
      ];
      setReservedHours(allReserved);
    };

    calculateAvailableHours();
  }, [reto, configuracion, editDate, editCanchaId, canchas]);

  const handleCreateReserva = async () => {
    if (
      !reto ||
      !editDate ||
      editHour === null ||
      !equipo2Encargado.trim() ||
      !equipo2Celular.trim()
    )
      return;

    setCreating(true);
    try {
      const horaInicio = new Date(editDate);
      horaInicio.setHours(editHour, 0, 0, 0);
      const horaFin = new Date(horaInicio);
      horaFin.setHours(horaFin.getHours() + 1);

      const formatLocalTimestamp = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const horaInicioStr = formatLocalTimestamp(horaInicio);
      const horaFinStr = formatLocalTimestamp(horaFin);

      // Check if reservation already exists at this hora_inicio
      let canchaIds: number[];
      if (editCanchaId === 6) {
        canchaIds = [6, ...LINKED_CANCHAS];
      } else if (LINKED_CANCHAS.includes(editCanchaId!)) {
        canchaIds = [editCanchaId!, 6];
      } else {
        canchaIds = [editCanchaId!];
      }

      const dateStr = formatLocalDate(editDate);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      // Check for existing reservations at this hora_inicio
      const { data: existingReservas, error: checkError } = await supabase
        .from("reservas")
        .select("id, hora_inicio")
        .in("cancha_id", canchaIds)
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay);

      if (checkError) throw checkError;

      // Check if any existing reservation has the same hora_inicio
      const hasConflict = (existingReservas || []).some((r) => {
        const existingHour = parseHourFromTimestamp(r.hora_inicio);
        return existingHour === editHour;
      });

      if (hasConflict) {
        throw new Error(
          "Ya existe una reservación para esta hora y cancha. Por favor seleccione otra hora."
        );
      }

      // Calculate total price
      const totalPrice = calculateTotalPrice();

      // Get current cancha for arbitro check
      const currentCancha = canchas.find((c) => c.id === editCanchaId!);

      // Create reserva
      const { data: reservaData, error: reservaError } = await supabase
        .from("reservas")
        .insert({
          hora_inicio: horaInicioStr,
          hora_fin: horaFinStr,
          nombre_reserva: reto.equipo1_encargado || "Reto",
          celular_reserva: reto.equipo1_celular,
          correo_reserva: null,
          cancha_id: editCanchaId!,
          precio: totalPrice,
          arbitro: currentCancha?.local === 2 ? editArbitro : false,
        })
        .select()
        .single();

      if (reservaError) throw reservaError;

      // Update reto with reserva_id and equipo2 info
      const { error: retoError } = await supabase
        .from("retos")
        .update({
          reserva_id: reservaData.id,
          cancha_id: editCanchaId!,
          hora_inicio: horaInicioStr,
          hora_fin: horaFinStr,
          fut: editFut!,
          arbitro: currentCancha?.local === 2 ? editArbitro : false,
          equipo2_nombre: equipo2Nombre.trim() || null,
          equipo2_encargado: equipo2Encargado.trim(),
          equipo2_celular: equipo2Celular.trim(),
        })
        .eq("id", reto.id);

      if (retoError) throw retoError;

      // Send emails to both teams if they have emails
      const djangoApiUrl = import.meta.env.VITE_DJANGO_API_URL || "";
      if (djangoApiUrl) {
        const reservaUrl = `${window.location.origin}/reserva/${reservaData.id}`;
        const currentCancha = canchas.find((c) => c.id === editCanchaId!);

        // Calculate player count
        const getPlayerCount = (): number => {
          if (currentCancha?.id === 6) {
            return editFut!;
          }
          return parseInt(currentCancha?.cantidad?.toString() || "0", 10);
        };

        const jugadores = getPlayerCount() * 2;

        // Send email to equipo1 if they have email
        if (reto.equipo1_correo && reto.equipo1_correo.trim()) {
          try {
            const emailPayload1 = {
              reserva_id: reservaData.id,
              hora_inicio: horaInicioStr,
              hora_fin: horaFinStr,
              cancha_id: editCanchaId!,
              cancha_nombre: currentCancha?.nombre || "",
              cancha_local: currentCancha?.local || 0,
              nombre_reserva: reto.equipo1_encargado || "Reto",
              celular_reserva: reto.equipo1_celular,
              correo_reserva: reto.equipo1_correo,
              precio: totalPrice,
              arbitro: currentCancha?.local === 2 ? editArbitro : false,
              jugadores: jugadores,
              reserva_url: reservaUrl,
            };

            await fetch(`${djangoApiUrl}/tellos/confirm-reservation`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailPayload1),
            });
          } catch (emailError) {
            console.error("Error sending email to equipo1:", emailError);
            // Don't fail the reservation creation if email fails
          }
        }

        // Send email to equipo2 if they have email
        // if (equipo2Correo && equipo2Correo.trim()) {
        //   try {
        //     const emailPayload2 = {
        //       reserva_id: reservaData.id,
        //       hora_inicio: horaInicioStr,
        //       hora_fin: horaFinStr,
        //       cancha_id: editCanchaId!,
        //       cancha_nombre: currentCancha?.nombre || "",
        //       cancha_local: currentCancha?.local || 0,
        //       nombre_reserva:
        //         equipo2Nombre.trim() || equipo2Encargado.trim() || "Reto",
        //       celular_reserva: equipo2Celular.trim(),
        //       correo_reserva: equipo2Correo.trim(),
        //       precio: totalPrice,
        //       arbitro: editArbitro,
        //       jugadores: jugadores,
        //       reserva_url: reservaUrl,
        //     };

        //     await fetch(`${djangoApiUrl}/tellos/confirm-reservation`, {
        //       method: "POST",
        //       headers: {
        //         "Content-Type": "application/json",
        //       },
        //       body: JSON.stringify(emailPayload2),
        //     });
        //   } catch (emailError) {
        //     console.error("Error sending email to equipo2:", emailError);
        //     // Don't fail the reservation creation if email fails
        //   }
        // }
      }

      setShowCreateConfirm(false);
      await onReservaCreated();
    } catch (error) {
      console.error("Error creating reserva:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error al crear la reservación. Por favor intente de nuevo.";
      alert(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setEditDate(date);
    setEditHour(null);
    setShowDateSelector(false);
    setShowHourSelector(true);
  };

  const handleCanchaSelect = (canchaId: number) => {
    setEditCanchaId(canchaId);
    setShowCanchaSelector(false);
    setEditDate(null);
    setEditHour(null);
    setShowDateSelector(true);

    // Update FUT based on cancha
    const selectedCancha = canchas.find((c) => c.id === canchaId);
    if (selectedCancha) {
      if (selectedCancha.id === 6) {
        // For cancha 6, default to FUT 6
        setEditFut(6);
      } else if (selectedCancha.cantidad) {
        // For other canchas, use their cantidad
        const cantidad = parseInt(selectedCancha.cantidad.toString(), 10);
        if (!isNaN(cantidad)) {
          setEditFut(cantidad);
        }
      }
      // Reset arbitro if switching to Sabana (local == 1)
      if (selectedCancha.local === 1) {
        setEditArbitro(false);
      }
    }
  };

  const handleVerReservacion = () => {
    if (!reto || !reto.reserva_id) return;
    navigate(`/admin/reservas-2`, {
      state: { reservaId: reto.reserva_id },
    });
  };

  const handleDeleteReto = async () => {
    if (!reto || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(reto.id);
      setShowDeleteConfirm(false);
      onClose();
      await onRefresh();
    } catch (error) {
      console.error("Error deleting reto:", error);
      alert("Error al eliminar el reto");
    } finally {
      setDeleting(false);
    }
  };

  if (!reto) return null;

  const currentCancha =
    canchas.find((c) => c.id === (editCanchaId || reto.cancha_id)) ||
    (reto.cancha
      ? {
          id: reto.cancha_id,
          nombre: reto.cancha.nombre,
          img: "",
          local: reto.local === "Sabana" ? 1 : 2,
          cantidad: "",
          precio: reto.cancha.precio,
        }
      : null);

  if (!currentCancha) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <DialogPanel
                transition
                className="pointer-events-auto w-screen max-w-2xl transform transition duration-500 ease-in-out data-closed:translate-x-full sm:duration-700"
              >
                <div className="relative flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl">
                  <div className="h-0 flex-1 overflow-y-auto">
                    <div className="bg-primary px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-base font-semibold text-white">
                          {mode === "assign" ? "Asignar Rival" : "Ver Reto"}
                        </DialogTitle>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            onClick={onClose}
                            className="relative rounded-md text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Cerrar panel</span>
                            <XMarkIcon aria-hidden="true" className="size-6" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-sm text-white/80">
                          {mode === "assign"
                            ? "Asigna un rival y crea la reservación."
                            : "Información del reto cerrado."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="divide-y divide-gray-200 px-4 sm:px-6">
                        <div className="space-y-6 pt-6 pb-5">
                          {/* Cancha Info */}
                          <div className="flex items-center gap-4">
                            {currentCancha.img && (
                              <img
                                src={currentCancha.img}
                                alt={currentCancha.nombre}
                                className="size-16 rounded-lg object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="text-base font-semibold text-gray-900">
                                {currentCancha.nombre}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {getLocalName(currentCancha.local)}
                              </p>
                            </div>
                            {mode === "assign" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowCanchaSelector(!showCanchaSelector)
                                }
                                className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              >
                                <PencilSquareIcon
                                  aria-hidden="true"
                                  className="size-5"
                                />
                              </button>
                            )}
                          </div>

                          {/* Cancha Selector */}
                          {showCanchaSelector && mode === "assign" && (
                            <div className="space-y-4 rounded-lg bg-gray-50 p-4 border border-gray-200">
                              <label className="block text-sm/6 font-medium text-gray-900">
                                Seleccionar Cancha
                              </label>
                              <div className="mt-2 grid grid-cols-1">
                                <select
                                  value={editCanchaId || ""}
                                  onChange={(e) =>
                                    handleCanchaSelect(Number(e.target.value))
                                  }
                                  className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white border border-gray-300 py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                >
                                  {canchas.map((cancha) => (
                                    <option
                                      key={cancha.id}
                                      value={cancha.id}
                                      className="bg-white text-gray-900"
                                    >
                                      {cancha.nombre} -{" "}
                                      {getLocalName(cancha.local)}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDownIcon
                                  aria-hidden="true"
                                  className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-400 sm:size-4"
                                />
                              </div>
                            </div>
                          )}

                          {/* Date Selection */}
                          <div>
                            <label
                              htmlFor="reto-date"
                              className="block text-sm/6 font-medium text-gray-900"
                            >
                              Fecha
                            </label>
                            <div className="mt-2 flex items-center gap-2">
                              {mode === "assign" ? (
                                <>
                                  <input
                                    id="reto-date"
                                    type="text"
                                    value={
                                      editDate
                                        ? `${editDate.getDate()} de ${
                                            MONTHS_SPANISH[editDate.getMonth()]
                                          } de ${editDate.getFullYear()}`
                                        : ""
                                    }
                                    readOnly
                                    className="flex-1 block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowDateSelector(!showDateSelector)
                                    }
                                    className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                  >
                                    <PencilSquareIcon
                                      aria-hidden="true"
                                      className="size-5"
                                    />
                                  </button>
                                </>
                              ) : (
                                <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6">
                                  {editDate
                                    ? `${editDate.getDate()} de ${
                                        MONTHS_SPANISH[editDate.getMonth()]
                                      } de ${editDate.getFullYear()}`
                                    : ""}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Date Selector */}
                          {showDateSelector && mode === "assign" && (
                            <div className="space-y-4 rounded-lg bg-gray-50 p-4 border border-gray-200">
                              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                <FaRegCalendarCheck className="text-primary" />
                                Seleccione una fecha
                              </h3>
                              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {dates.map((date, index) => {
                                  const isSelected =
                                    editDate &&
                                    date.toDateString() ===
                                      editDate.toDateString();
                                  const isToday = index === 0;
                                  return (
                                    <button
                                      key={date.toISOString()}
                                      type="button"
                                      onClick={() => handleDateSelect(date)}
                                      className={`shrink-0 w-16 py-3 rounded-xl border transition-all flex flex-col items-center ${
                                        isSelected
                                          ? "bg-primary border-primary text-white"
                                          : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                      }`}
                                    >
                                      <span className="text-4xl tracking-tighter font-semibold">
                                        {date.getDate()}
                                      </span>
                                      <span className="text-xs tracking-tight uppercase mt-1.5">
                                        {isToday
                                          ? "Hoy"
                                          : DAYS_SPANISH[date.getDay()]}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Hour Selection */}
                          <div>
                            <label className="block text-sm/6 font-medium text-gray-900">
                              Hora
                            </label>
                            <div className="mt-2">
                              {mode === "assign" ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={
                                        editHour !== null
                                          ? `${String(editHour).padStart(
                                              2,
                                              "0"
                                            )}:00`
                                          : ""
                                      }
                                      readOnly
                                      className="flex-1 block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowHourSelector(!showHourSelector)
                                      }
                                      className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                    >
                                      <PencilSquareIcon
                                        aria-hidden="true"
                                        className="size-5"
                                      />
                                    </button>
                                  </div>
                                  {showHourSelector && (
                                    <div className="space-y-3 rounded-lg bg-gray-50 p-4 border border-gray-200">
                                      <h3 className="text-sm font-medium text-gray-900 flex gap-2 items-center">
                                        <FaRegClock className="text-primary" />
                                        Seleccione una hora
                                      </h3>
                                      <div className="grid grid-cols-4 gap-2">
                                        {availableHours.map((hour) => {
                                          const isReserved =
                                            reservedHours.includes(hour);
                                          const isSelected = editHour === hour;
                                          return (
                                            <button
                                              key={hour}
                                              type="button"
                                              onClick={() => {
                                                if (!isReserved) {
                                                  setEditHour(hour);
                                                  setShowHourSelector(false);
                                                }
                                              }}
                                              disabled={isReserved}
                                              className={`py-3 text-base tracking-tight rounded-lg border transition-all font-medium ${
                                                isReserved
                                                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed line-through"
                                                  : isSelected
                                                  ? "bg-primary border-primary text-white"
                                                  : "bg-white border-primary border-dashed text-gray-900 hover:bg-primary/10"
                                              }`}
                                            >
                                              {hour}:00
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {availableHours.every((h) =>
                                        reservedHours.includes(h)
                                      ) && (
                                        <p className="text-gray-500 text-sm text-center mt-4">
                                          No hay horarios disponibles para esta
                                          fecha
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="block w-full rounded-md bg-gray-50 border border-gray-300 px-3 py-1.5 text-base text-gray-900 sm:text-sm/6">
                                  {editHour !== null
                                    ? `${String(editHour).padStart(2, "0")}:00`
                                    : ""}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Equipo 1 Section */}
                          <div>
                            <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                              Equipo 1
                            </h3>
                            <div className="space-y-2">
                              <div>
                                <p className="text-sm text-gray-600">Nombre</p>
                                <p className="text-sm text-gray-900">
                                  {reto.equipo1_nombre || "Sin nombre"}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">
                                  Encargado
                                </p>
                                <p className="text-sm text-gray-900">
                                  {reto.equipo1_encargado}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Celular</p>
                                <p className="text-sm text-gray-900">
                                  {reto.equipo1_celular}
                                </p>
                              </div>
                              {reto.equipo1_correo && (
                                <div>
                                  <p className="text-sm text-gray-600">
                                    Correo
                                  </p>
                                  <p className="text-sm text-gray-900">
                                    {reto.equipo1_correo}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Equipo 2 Section */}
                          {mode === "assign" ? (
                            <div>
                              <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                                Equipo 2 (Rival)
                              </h3>
                              <div className="space-y-4">
                                <div>
                                  <label
                                    htmlFor="equipo2-nombre"
                                    className="block text-sm/6 font-medium text-gray-900"
                                  >
                                    Nombre de equipo (opcional)
                                  </label>
                                  <div className="mt-2">
                                    <input
                                      id="equipo2-nombre"
                                      type="text"
                                      value={equipo2Nombre}
                                      onChange={(e) =>
                                        setEquipo2Nombre(e.target.value)
                                      }
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                      placeholder="Nombre del equipo"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label
                                    htmlFor="equipo2-encargado"
                                    className="block text-sm/6 font-medium text-gray-900"
                                  >
                                    Encargado *
                                  </label>
                                  <div className="mt-2">
                                    <input
                                      id="equipo2-encargado"
                                      type="text"
                                      value={equipo2Encargado}
                                      onChange={(e) =>
                                        setEquipo2Encargado(e.target.value)
                                      }
                                      required
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                      placeholder="Nombre del encargado"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label
                                    htmlFor="equipo2-celular"
                                    className="block text-sm/6 font-medium text-gray-900"
                                  >
                                    Celular *
                                  </label>
                                  <div className="mt-2">
                                    <input
                                      id="equipo2-celular"
                                      type="tel"
                                      value={equipo2Celular}
                                      onChange={(e) =>
                                        setEquipo2Celular(e.target.value)
                                      }
                                      required
                                      className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                      placeholder="Número de celular"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                                Equipo 2
                              </h3>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-sm text-gray-600">
                                    Nombre
                                  </p>
                                  <p className="text-sm text-gray-900">
                                    {reto.equipo2_nombre || "Sin nombre"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">
                                    Encargado
                                  </p>
                                  <p className="text-sm text-gray-900">
                                    {reto.equipo2_encargado || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">
                                    Celular
                                  </p>
                                  <p className="text-sm text-gray-900">
                                    {reto.equipo2_celular || "N/A"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* FUT Selection */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm/6 font-medium text-gray-900">
                                FUT
                              </h3>
                              {mode === "assign" && (
                                <button
                                  type="button"
                                  onClick={() => setShowFutEdit(!showFutEdit)}
                                  className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                  <PencilSquareIcon
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                </button>
                              )}
                            </div>
                            {showFutEdit && mode === "assign" ? (
                              <div>
                                <select
                                  value={editFut || ""}
                                  onChange={(e) =>
                                    setEditFut(Number(e.target.value))
                                  }
                                  className="block w-full rounded-md bg-white border border-gray-300 px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-sm/6"
                                >
                                  {currentCancha.id === 6 ? (
                                    <>
                                      <option value="6">6</option>
                                      <option value="7">7</option>
                                      <option value="8">8</option>
                                    </>
                                  ) : (
                                    <option value={currentCancha.cantidad}>
                                      {currentCancha.cantidad}
                                    </option>
                                  )}
                                </select>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-gray-900">
                                <TbRun className="text-primary" />
                                <TbPlayFootball className="text-primary -ml-0.5" />
                                {reto.fut}
                              </div>
                            )}
                          </div>

                          {/* Árbitro - Only for Guadalupe (local == 2) */}
                          {currentCancha?.local === 2 && (
                            <div>
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm/6 font-medium text-gray-900">
                                  Árbitro
                                </h3>
                                {mode === "assign" ? (
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editArbitro}
                                      onChange={(e) =>
                                        setEditArbitro(e.target.checked)
                                      }
                                      className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                  </label>
                                ) : (
                                  <div className="flex items-center gap-2 text-sm text-gray-900">
                                    {reto.arbitro ? (
                                      <>
                                        <GiWhistle className="text-primary" />
                                        Sí
                                      </>
                                    ) : (
                                      <span>No</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Price Information */}
                          <div>
                            <h3 className="text-sm/6 font-medium text-gray-900 mb-3">
                              Precio Total
                            </h3>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                  Precio base:
                                </span>
                                <span className="text-gray-900 font-medium">
                                  ₡{" "}
                                  {(() => {
                                    if (!editCanchaId || !editFut) return "0";
                                    const currentCancha = canchas.find(
                                      (c) => c.id === editCanchaId
                                    );
                                    if (!currentCancha) return "0";
                                    let basePrice: number;
                                    if (currentCancha.id === 6) {
                                      if (editFut === 6) basePrice = 40000;
                                      else if (editFut === 7) basePrice = 45000;
                                      else if (editFut === 8) basePrice = 50000;
                                      else basePrice = 40000;
                                    } else {
                                      const precioStr =
                                        currentCancha.precio || "0";
                                      basePrice =
                                        parseInt(
                                          precioStr.replace(/\./g, ""),
                                          10
                                        ) || 0;
                                    }
                                    return basePrice.toLocaleString();
                                  })()}
                                </span>
                              </div>
                              {currentCancha?.local === 2 && editArbitro && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600 flex items-center gap-1">
                                    <GiWhistle className="text-primary" />
                                    Árbitro:
                                  </span>
                                  <span className="text-gray-900 font-medium">
                                    ₡ 5,000
                                  </span>
                                </div>
                              )}
                              <div className="border-t border-gray-200 pt-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-900 font-semibold">
                                    Total:
                                  </span>
                                  <span className="text-gray-900 font-bold text-lg">
                                    ₡ {calculateTotalPrice().toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {mode === "assign" && (
                    <div className="px-4 py-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-4">
                        <p className="text-gray-900 text-sm">
                          <strong className="text-yellow-600">
                            Importante:
                          </strong>{" "}
                          Debe notificar a{" "}
                          <strong className="text-yellow-600">
                            AMBOS equipos
                          </strong>{" "}
                          cuando el reto esté confirmado.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex shrink-0 justify-end px-4 py-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                    {mode === "assign" ? (
                      <>
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleting}
                            className="ml-4 inline-flex justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed"
                          >
                            {deleting ? "Eliminando..." : "Eliminar Reto"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowCreateConfirm(true)}
                          disabled={
                            creating ||
                            !equipo2Encargado.trim() ||
                            !equipo2Celular.trim() ||
                            editHour === null ||
                            !editDate ||
                            !editCanchaId ||
                            !editFut
                          }
                          className="ml-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-700 disabled:cursor-not-allowed"
                        >
                          {creating ? (
                            <>
                              <ArrowPathIcon className="size-4 animate-spin" />
                              Creando...
                            </>
                          ) : (
                            "Crear Reservación"
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleVerReservacion}
                        className="ml-4 inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Ver Reservación
                      </button>
                    )}
                  </div>
                </div>
              </DialogPanel>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Create Confirmation Dialog */}
      <Dialog
        open={showCreateConfirm}
        onClose={() => setShowCreateConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Está seguro de crear esta reservación?
              </DialogTitle>
              <p className="text-sm text-gray-600 mb-4">
                Se creará la reservación y se actualizará el reto con el rival
                asignado.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateReserva}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90"
                >
                  Crear
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/80" />
        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel className="relative transform w-full overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl ring-1 ring-black/5 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95">
              <DialogTitle className="text-base font-semibold text-gray-900 mb-4">
                ¿Está seguro de eliminar este reto?
              </DialogTitle>
              <p className="text-sm text-gray-600 mb-4">
                Esta acción no se puede deshacer. El reto será eliminado
                permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteReto}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
