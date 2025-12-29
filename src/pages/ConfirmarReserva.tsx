import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { IoArrowBack } from "react-icons/io5";
import { MdLocationOn } from "react-icons/md";
import { FaUsers } from "react-icons/fa6";
import { FaRegCalendarCheck } from "react-icons/fa";
import { IoWarning } from "react-icons/io5";
import { GiWhistle } from "react-icons/gi";
import { supabase } from "../lib/supabase";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio?: string;
}

interface ReservationState {
  cancha: Cancha;
  selectedDate: string; // ISO string
  selectedHour: number;
  selectedPlayers: number | null;
  precio: number;
  arbitro: boolean;
}

const DAYS_SPANISH = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_SPANISH = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function ConfirmarReserva() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ReservationState | null;

  // Form states
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [correo, setCorreo] = useState("");

  // Arbitro state (can be modified here too)
  const [arbitroLocal, setArbitroLocal] = useState(false);

  // SINPE acknowledgment toggle (for local == 1 Sabana only)
  const [sinpeAcknowledged, setSinpeAcknowledged] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Loading state for submission
  const [submitting, setSubmitting] = useState(false);

  // Loading messages slideshow
  const loadingMessages = [
    "Cargando",
    "Danos un segundo",
    "Ya casi",
    "Vamo' al fútbol",
    "Casi listo",
    ":)",
  ];
  const [currentLoadingMessageIndex, setCurrentLoadingMessageIndex] =
    useState(0);

  // Email sending state
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  // Stored reservation data after successful insert
  const [reservaId, setReservaId] = useState<number | null>(null);
  // Use a ref for created_at to avoid async state issues
  const reservaCreatedAtRef = useRef<string | null>(null);

  // Referee cost
  const ARBITRO_COST = 5000;

  // Cycle through loading messages when submitting
  useEffect(() => {
    if (!submitting) {
      setCurrentLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentLoadingMessageIndex((prev) => {
        const next = (prev + 1) % loadingMessages.length;
        return next;
      });
    }, 1500); // Change message every 1.5 seconds

    return () => clearInterval(interval);
  }, [submitting, loadingMessages.length]);

  // Handle missing state
  if (!state) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-red-400 text-lg text-center">
          No se encontró información de la reservación
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const {
    cancha,
    selectedDate,
    selectedHour,
    selectedPlayers,
    precio,
    arbitro: arbitroFromState,
  } = state;

  const date = new Date(selectedDate);

  // Use local arbitro state, initialized from navigation state
  const effectiveArbitro = arbitroLocal || arbitroFromState;

  // Get base price (cancha only, without arbitro added here)
  const getBasePrice = (): number => {
    // If arbitro was already included in precio from CanchaDetails, subtract it
    if (arbitroFromState) {
      return precio - ARBITRO_COST;
    }
    return precio;
  };

  // Calculate final price with potential arbitro addition
  const getFinalPrice = (): number => {
    // If arbitro was already included in precio from CanchaDetails, don't add again
    // But if user adds it here, we need to add it
    if (arbitroLocal && !arbitroFromState) {
      return precio + ARBITRO_COST;
    }
    return precio;
  };

  // Validation helpers
  const isValidCelular = (cel: string): boolean => {
    const digitsOnly = cel.replace(/\D/g, "");
    return digitsOnly.length >= 8;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid
  const isFormValid =
    nombre.trim() && isValidCelular(celular) && isValidEmail(correo);

  // For Sabana (local == 1), also require SINPE acknowledgment
  const canSubmit = isFormValid && (cancha.local === 2 || sinpeAcknowledged);

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `Local ${local}`;
  };

  const formatDate = (): string => {
    const day = date.getDate();
    const dayName = DAYS_SPANISH[date.getDay()];
    const month = MONTHS_SPANISH[date.getMonth()];
    return `${dayName} ${day} de ${month}`;
  };

  const getPlayerCount = (): number => {
    if (selectedPlayers) return selectedPlayers;
    return parseInt(cancha.cantidad?.toString() || "0", 10);
  };

  const handleConfirmar = async () => {
    if (submitting) return;

    setSubmitting(true);
    setEmailSent(null); // Reset email status

    try {
      // Build hora_inicio timestamp (format as local time, not UTC)
      const horaInicio = new Date(date);
      horaInicio.setHours(selectedHour, 0, 0, 0);

      // Build hora_fin (1 hour later)
      const horaFin = new Date(horaInicio);
      horaFin.setHours(horaFin.getHours() + 1);

      // Format as local timestamp string "YYYY-MM-DD HH:MM:SS" to avoid UTC conversion
      const formatLocalTimestamp = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const finalPrice = getFinalPrice();

      // Insert into reservas table
      const { data, error } = await supabase
        .from("reservas")
        .insert({
          hora_inicio: formatLocalTimestamp(horaInicio),
          hora_fin: formatLocalTimestamp(horaFin),
          nombre_reserva: nombre,
          celular_reserva: celular,
          correo_reserva: correo,
          cancha_id: cancha.id,
          precio: finalPrice,
          arbitro: effectiveArbitro,
        })
        .select()
        .single();

      if (error) throw error;

      // Store the reservation ID and created_at for navigation
      setReservaId(data.id);
      reservaCreatedAtRef.current = data.created_at;

      // Call Django endpoint to send confirmation email
      try {
        const djangoApiUrl = import.meta.env.VITE_DJANGO_API_URL || "";
        if (djangoApiUrl) {
          const reservaUrl = `${window.location.origin}/reserva/${data.id}`;

          // Format datetime strings for Django endpoint
          const horaInicioStr = formatLocalTimestamp(horaInicio);
          const horaFinStr = formatLocalTimestamp(horaFin);

          const emailPayload = {
            reserva_id: data.id,
            hora_inicio: horaInicioStr,
            hora_fin: horaFinStr,
            cancha_id: cancha.id,
            cancha_nombre: cancha.nombre,
            cancha_local: cancha.local,
            nombre_reserva: nombre,
            celular_reserva: celular,
            correo_reserva: correo,
            precio: finalPrice,
            arbitro: effectiveArbitro,
            jugadores: getPlayerCount() * 2,
            reserva_url: reservaUrl,
          };

          const response = await fetch(
            `${djangoApiUrl}/tellos/confirm-reservation`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailPayload),
            }
          );

          if (response.ok) {
            const result = await response.json();
            setEmailSent(result.email_sent || false);
          } else {
            console.error("Error sending email:", response.statusText);
            setEmailSent(false);
          }
        } else {
          console.warn("Django API URL not configured");
          setEmailSent(false);
        }
      } catch (error) {
        console.error("Error calling email endpoint:", error);
        setEmailSent(false);
      }

      // Show success dialog
      setDialogOpen(true);
    } catch (error) {
      console.error("Error creating reservation:", error);
      alert("Error al crear la reservación. Por favor intente de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    // Navigate to reservation details page with all necessary data
    // Use replace: true to remove ConfirmarReserva from history
    navigate(`/reserva/${reservaId}`, {
      replace: true,
      state: {
        cancha,
        selectedDate,
        selectedHour,
        selectedPlayers,
        precio: getFinalPrice(),
        arbitro: effectiveArbitro,
        nombre,
        celular,
        correo,
        reservaId,
        createdAt: reservaCreatedAtRef.current,
      },
    });
  };

  return (
    <div className="min-h-screen bg-bg pb-32 px-0 py-0 sm:px-6 lg:px-8 relative">
      {/* Loading Overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            {/* Spinner */}
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary border-r-transparent border-l-transparent"></div>
            {/* Loading Message */}
            <p className="text-white text-base font-medium animate-pulse">
              {loadingMessages[currentLoadingMessageIndex]}
            </p>
          </div>
        </div>
      )}
      {/* Header with back button */}
      <div className="top-0 z-10 bg-bg/95 backdrop-blur-sm px-2 pb-2 flex items-center gap-3 border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <IoArrowBack className="text-xl text-white" />
        </button>
        <h1 className="text-lg tracking-tight font-medium text-white truncate">
          Confirmar Reservación
        </h1>
      </div>

      {/* Cancha Summary */}
      <div className="px-4 mb-6">
        <div className="relative w-full h-48 rounded-2xl overflow-hidden">
          <img
            src={cancha.img}
            alt={cancha.nombre}
            className="w-full h-full object-cover"
          />
          {/* Overlay with info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-xl font-bold text-white mb-2">
              {cancha.nombre}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <MdLocationOn className="text-secondary text-sm" />
                <span className="text-white text-sm">
                  {getLocalName(cancha.local)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <FaUsers className="text-white text-sm" />
                <span className="text-white text-sm">
                  {getPlayerCount() * 2} jugadores
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Details */}
      <div className="px-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaRegCalendarCheck className="text-secondary" />
              <span className="text-white/80 text-sm">Fecha y hora</span>
            </div>
            <span className="text-white font-medium">
              {formatDate()} - {selectedHour}:00
            </span>
          </div>
          <div className="border-t border-white/10" />
          {/* Precio por cancha */}
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm">Precio por cancha</span>
            <span className="text-white font-medium">
              ₡ {getBasePrice().toLocaleString()}
            </span>
          </div>
          {/* Arbitro (if selected) */}
          {effectiveArbitro && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GiWhistle className="text-secondary text-sm" />
                <span className="text-white/80 text-sm">Árbitro incluido</span>
              </div>
              <span className="text-white font-medium">+ ₡5,000</span>
            </div>
          )}
          <div className="border-t border-white/10" />
          {/* Precio total */}
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm font-medium">
              Precio total
            </span>
            <span className="text-white font-bold text-lg">
              ₡ {getFinalPrice().toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Arbitro checkbox (if not already selected) */}
      {!arbitroFromState && (
        <div className="px-4 mb-6">
          <div className="flex gap-3">
            <div className="flex h-6 shrink-0 items-center">
              <div className="group grid size-4 grid-cols-1">
                <input
                  id="arbitro-confirm"
                  name="arbitro-confirm"
                  type="checkbox"
                  checked={arbitroLocal}
                  onChange={(e) => setArbitroLocal(e.target.checked)}
                  className="col-start-1 row-start-1 appearance-none rounded-sm border border-white/10 bg-white/5 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10 forced-colors:appearance-auto"
                />
                <svg
                  fill="none"
                  viewBox="0 0 14 14"
                  className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-white/25"
                >
                  <path
                    d="M3 8L6 11L11 3.5"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-0 group-has-checked:opacity-100"
                  />
                </svg>
              </div>
            </div>
            <div className="text-sm/6">
              <label
                htmlFor="arbitro-confirm"
                className="font-medium text-white flex items-center gap-2"
              >
                <GiWhistle className="text-secondary" />
                Contratar árbitro
              </label>
              <p className="text-gray-400">+₡5,000 al precio total</p>
            </div>
          </div>
        </div>
      )}

      {/* Warning Banner - Only for Sabana (local == 1) */}
      {cancha.local === 1 && (
        <div className="px-4 mb-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <IoWarning className="text-yellow-500 text-xl shrink-0 mt-0.5" />
              <p className="text-white/90 text-sm">
                Tiene <strong className="text-yellow-500">2 horas</strong> para
                realizar el SINPE y subir el comprobante para mantener su
                reservación. Si no lo realiza, su reservación se cancelará
                automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pay at field note - Only for Guadalupe (local == 2) */}
      {cancha.local === 2 && (
        <div className="px-4 mb-6">
          <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-4">
            <p className="text-white/90 text-sm text-center">
              💵 El pago se realiza directamente en la cancha
            </p>
          </div>
        </div>
      )}

      {/* SINPE Acknowledgment Toggle - Only for Sabana (local == 1) */}
      {cancha.local === 1 && (
        <div className="px-4 mb-6">
          <div
            className={`flex items-center justify-between bg-white/5 rounded-xl p-4 ${
              sinpeAcknowledged ? "animate-none" : "animate-pulse"
            }`}
          >
            <span className="flex grow flex-col">
              <label
                id="sinpe-label"
                className="text-sm/6 font-medium text-white"
              >
                Confirmo que realizaré el SINPE
              </label>
              <span id="sinpe-description" className="text-sm text-gray-400">
                Entiendo que tengo 2 horas para subir el comprobante o mi
                reservación será cancelada
              </span>
            </span>
            <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-white/5 p-0.5 inset-ring inset-ring-white/10 outline-offset-2 outline-primary transition-colors duration-200 ease-in-out has-checked:bg-primary has-focus-visible:outline-2 ml-4">
              <span className="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5" />
              <input
                id="sinpe-toggle"
                name="sinpe-toggle"
                type="checkbox"
                checked={sinpeAcknowledged}
                onChange={(e) => setSinpeAcknowledged(e.target.checked)}
                aria-labelledby="sinpe-label"
                aria-describedby="sinpe-description"
                className="absolute inset-0 size-full appearance-none focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* Contact Form */}
      <div className="px-4 mb-6 space-y-4">
        <h3 className="text-white font-medium">Datos de contacto</h3>

        {/* Nombre */}
        <div>
          <label
            htmlFor="nombre"
            className="block text-sm/6 font-medium text-white"
          >
            Nombre completo
          </label>
          <div className="mt-2">
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Mi Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
            />
          </div>
        </div>

        {/* Celular */}
        <div>
          <label
            htmlFor="celular"
            className="block text-sm/6 font-medium text-white"
          >
            Celular
          </label>
          <div className="mt-2">
            <input
              id="celular"
              name="celular"
              type="tel"
              placeholder="8888-8888"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
            />
          </div>
        </div>

        {/* Correo */}
        <div>
          <label
            htmlFor="correo"
            className="block text-sm/6 font-medium text-white"
          >
            Correo electrónico
          </label>
          <div className="mt-2">
            <input
              id="correo"
              name="correo"
              type="email"
              placeholder="micorreo@ejemplo.com"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
            />
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0  left-0 right-0 bg-bg/95 backdrop-blur-sm border-t border-gray-800 px-4 py-4 z-20">
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => navigate(-1)}
            className=" py-3 w-1/4  rounded-lg font-medium flex items-center justify-center gap-2 transition-all bg-white/10 text-white hover:bg-white/20"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!canSubmit || submitting}
            className={` py-3 w-2/5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              canSubmit && !submitting
                ? "bg-primary text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            <FaRegCalendarCheck className="text-lg" />
            {submitting ? "Cargando" : "Confirmar"}
          </button>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={dialogOpen} onClose={() => {}} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/80 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform w-full overflow-hidden rounded-lg bg-bg px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-white/10 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <div>
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-500/10">
                  <CheckIcon
                    aria-hidden="true"
                    className="size-6 text-secondary"
                  />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <DialogTitle
                    as="h3"
                    className="text-base font-semibold text-white"
                  >
                    ¡Reservación Confirmada!
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-400">
                      Su reservación ha sido registrada con éxito.
                      {cancha.local === 1 && (
                        <>
                          Ahora puede subir su comprobante de SINPE en la
                          siguiente página para confirmar el pago.
                        </>
                      )}
                    </p>
                    {emailSent !== null && (
                      <p
                        className={`text-xs mt-2 ${
                          emailSent ? "text-green-400" : "text-yellow-400"
                        }`}
                      >
                        {emailSent
                          ? "(Email enviado con detalles de reservación)"
                          : "No pudimos enviarle la reservacion)"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  onClick={handleDialogClose}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Entendido
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default ConfirmarReserva;
