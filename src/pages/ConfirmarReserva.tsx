import { useState } from "react";
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
  precioPorPersona: number;
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if form is valid
  const isFormValid = nombre.trim() && celular.trim() && correo.trim();

  // Handle missing state
  if (!state) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-red-400 text-lg text-center">
          No se encontró información de la reserva
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
    precioPorPersona,
  } = state;

  const date = new Date(selectedDate);

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

  const handleConfirmar = () => {
    // Log the reservation data
    const reservaData = {
      cancha: {
        id: cancha.id,
        nombre: cancha.nombre,
        local: getLocalName(cancha.local),
      },
      fecha: date.toISOString().split("T")[0],
      hora: `${selectedHour}:00`,
      jugadores: getPlayerCount() * 2,
      precio,
      precioPorPersona,
      contacto: {
        nombre,
        celular,
        correo,
      },
    };

    console.log("=== RESERVA CONFIRMADA ===");
    console.log(JSON.stringify(reservaData, null, 2));

    // Show success dialog
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-bg pb-32 px-0 py-0 sm:px-6 lg:px-8">
      {/* Header with back button */}
      <div className="top-0 z-10 bg-bg/95 backdrop-blur-sm px-2 pb-2 flex items-center gap-3 border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <IoArrowBack className="text-xl text-white" />
        </button>
        <h1 className="text-lg tracking-tight font-medium text-white truncate">
          Confirmar Reserva
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
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm">Precio total</span>
            <span className="text-white font-bold text-lg">
              ₡ {precio.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm">
              Precio por persona (aprox)
            </span>
            <span className="text-white font-medium">
              ₡ {precioPorPersona.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="px-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-4">
          <div className="flex items-start gap-3">
            <IoWarning className="text-yellow-500 text-xl shrink-0 mt-0.5" />
            <p className="text-white/90 text-sm">
              Tiene <strong className="text-yellow-500">2 horas</strong> para
              realizar el SINPE y subir el comprobante para mantener su reserva.
              Si no lo realiza, su reserva se cancelará automáticamente.
            </p>
          </div>
        </div>
      </div>

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
            disabled={!isFormValid}
            className={` py-3 w-2/5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isFormValid
                ? "bg-primary text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            <FaRegCalendarCheck className="text-lg" />
            Confirmar
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
              className="relative transform overflow-hidden rounded-lg bg-bg px-4 pt-5 pb-4 text-left shadow-xl outline -outline-offset-1 outline-white/10 transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-sm sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
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
                    ¡Reserva Confirmada!
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-400">
                      Su reserva ha sido registrada. Ahora puede subir su
                      comprobante de SINPE en la siguiente página para confirmar
                      el pago.
                    </p>
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
