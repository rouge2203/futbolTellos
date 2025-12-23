import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import { MdLocationOn, MdContentCopy } from "react-icons/md";
import { FaUsers, FaWaze, FaMapMarkerAlt, FaWhatsapp } from "react-icons/fa";
import { FaCheck } from "react-icons/fa";
import { IoWarning } from "react-icons/io5";
import { GiWhistle } from "react-icons/gi";
import { FiUpload, FiClock } from "react-icons/fi";
import { supabase } from "../lib/supabase";
import { ImCross } from "react-icons/im";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio?: string;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  cancha_id: number;
  precio: number;
  arbitro: boolean;
  created_at: string;
  cancha?: Cancha;
  sinpe_reserva: string | null;
  confirmada: boolean | null;
}

const DAYS_SPANISH = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
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

function ReservaDetalles() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [cancha, setCancha] = useState<Cancha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch reservation data from database
  useEffect(() => {
    const fetchReserva = async () => {
      if (!id) {
        setError("ID de reserva no encontrado");
        setLoading(false);
        return;
      }

      try {
        // Fetch reservation with cancha data
        const { data: reservaData, error: reservaError } = await supabase
          .from("reservas")
          .select(
            `
            *,
            cancha:cancha_id (
              id,
              nombre,
              img,
              cantidad,
              local,
              precio
            )
          `
          )
          .eq("id", id)
          .single();

        if (reservaError) throw reservaError;
        if (!reservaData) {
          setError("Reserva no encontrada");
          setLoading(false);
          return;
        }

        setReserva(reservaData);
        setCancha(reservaData.cancha);
      } catch (err) {
        console.error("Error fetching reserva:", err);
        setError(
          "No se encuentra esta reserva. Es posible que haya sido cancelada o haya pasado el tiempo limite para realizar el adelanto."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReserva();
  }, [id]);

  // Check if deadline has passed
  useEffect(() => {
    if (!reserva || !cancha || cancha.local !== 1) return;

    const checkExpired = () => {
      const deadline = new Date(reserva.created_at);
      deadline.setHours(deadline.getHours() + 2);
      setIsExpired(new Date() > deadline);
    };

    checkExpired();
    const interval = setInterval(checkExpired, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [reserva, cancha]);

  // Calculate deadline time (2 hours from created_at)
  const getDeadlineTime = (): string => {
    if (!reserva?.created_at) return "";
    const deadline = new Date(reserva.created_at);
    deadline.setHours(deadline.getHours() + 2);
    const hours = deadline.getHours().toString().padStart(2, "0");
    const minutes = deadline.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Error state
  if (error || !reserva || !cancha) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <ImCross className="text-red-400 text-3xl" />
        <div className="text-red-400 text-lg text-center">
          {error || "No se encontró información de la reserva"}
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

  // Parse hour from timestamp string (handles both ISO and local formats)
  const parseHourFromTimestamp = (timestamp: string): number => {
    // If it's a local format like "2025-12-24 08:00:00", extract hour directly
    const timeMatch = timestamp.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      return parseInt(timeMatch[1], 10);
    }
    // Fallback to Date parsing
    return new Date(timestamp).getHours();
  };

  // Parse date from timestamp (for display, handles local format)
  const parseDateFromTimestamp = (timestamp: string): Date => {
    // For local format "2025-12-24 08:00:00", parse manually to avoid timezone issues
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
    // Fallback
    return new Date(timestamp);
  };

  // Extract data from reserva
  const selectedHour = parseHourFromTimestamp(reserva.hora_inicio);
  const date = parseDateFromTimestamp(reserva.hora_inicio);
  const precio = reserva.precio;
  const arbitro = reserva.arbitro;
  const nombre = reserva.nombre_reserva;
  const celular = reserva.celular_reserva;
  const reservaId = reserva.id;
  const deadlineTime = getDeadlineTime();

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
    // For special canchas (7-8-9), we can estimate from price
    if (cancha.cantidad === "7-8-9") {
      if (precio === 40000) return 7;
      if (precio === 45000) return 8;
      if (precio === 50000) return 9;
      // If arbitro is included, subtract 5000 first
      const basePrice = arbitro ? precio - 5000 : precio;
      if (basePrice === 40000) return 7;
      if (basePrice === 45000) return 8;
      if (basePrice === 50000) return 9;
    }
    return parseInt(cancha.cantidad?.toString() || "0", 10);
  };

  // Calculate price per person
  const getPricePerPerson = (): number => {
    const playerCount = getPlayerCount();
    if (playerCount > 0) {
      return Math.ceil(precio / (playerCount * 2));
    }
    return 0;
  };

  // Calculate 50% for SINPE
  const sinpeAmount = Math.ceil(precio / 2);

  // Current page URL for sharing
  const reservaUrl = `${window.location.origin}/reserva/${reservaId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reservaUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // File validation: must be image, max 20MB
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/JPG",
    "image/png",
    "image/PNG",
    "image/webp",
    "image/WEBP",
  ];

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Solo se permiten archivos de imagen";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "El archivo es muy grande. Máximo 20MB";
    }
    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      setSelectedFile(null);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
  };

  const handleUploadComprobante = async () => {
    if (!selectedFile || !reserva) return;

    setUploading(true);
    setUploadError(null);

    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `reserva_${reserva.id}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("Sinpes")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("Sinpes")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      console.log("Public URL:", publicUrl);
      console.log("Updating reserva ID:", reserva.id);

      // Update reserva with the file URL
      const { data: updateData, error: updateError } = await supabase
        .from("reservas")
        .update({ sinpe_reserva: publicUrl })
        .eq("id", reserva.id)
        .select()
        .single();

      console.log("Update result:", updateData, updateError);

      if (updateError) throw updateError;

      if (!updateData) {
        throw new Error("No se pudo actualizar la reserva");
      }

      // Refresh reserva data
      setReserva({ ...reserva, sinpe_reserva: publicUrl });
      setSelectedFile(null);
    } catch (err) {
      console.error("Error uploading file:", err);
      setUploadError("Error al subir el archivo. Por favor intente de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  // Placeholder URLs for maps
  const googleMapsUrl = "#"; // TODO: Add actual coordinates
  const wazeUrl = "#"; // TODO: Add actual coordinates

  return (
    <div className="min-h-screen bg-bg pb-8 px-0 py-0 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="top-0 z-10 bg-bg/95 backdrop-blur-sm px-2 pb-2 flex items-center gap-3 border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <IoArrowBack className="text-xl text-white" />
        </button>
        <h1 className="text-lg tracking-tight font-medium text-white truncate">
          Detalles de Reserva
        </h1>
      </div>

      {/* Success Banner */}
      <div className="px-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-4">
          <p className="text-white/90 text-sm  justify-center flex items-start  gap-2">
            <FaCheck className=" mt-1" /> Reserva de {nombre} registrada
            exitosamente
          </p>
        </div>
      </div>

      {/* Reservation Summary */}
      <div className="px-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={cancha.img}
              alt={cancha.nombre}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div>
              <h2 className="text-white font-bold">{cancha.nombre}</h2>
              <div className="flex items-center gap-1">
                <MdLocationOn className="text-secondary text-sm" />
                <span className="text-white/80 text-sm">
                  {getLocalName(cancha.local)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Details Grid */}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <p className="text-white/60 text-xs">Fecha y hora</p>
              <p className="text-white font-medium tracking-tight">
                {formatDate()} - {selectedHour}:00
              </p>
            </div>
            <div>
              {/* <p className="text-white/60 text-xs">Jugadores</p> */}
              <p className="text-white  text-sm flex items-center gap-2">
                <FaUsers className="text-secondary" />
                {getPlayerCount() * 2} jugadores
              </p>
            </div>
            {arbitro && (
              <>
                <div className="flex items-center gap-2 -mt-1">
                  <GiWhistle className="text-secondary" />
                  <span className="text-white text-sm">
                    Árbitro incluido (+ ₡5,000)
                  </span>
                </div>
                <div className=" border-white/10" />
              </>
            )}

            <div>
              <p className="text-white/60 text-xs track">Precio total</p>
              <p className="text-white font-bold text-lg tracking-tight">
                ₡ {precio.toLocaleString()}
              </p>
            </div>
            {/* <div>
              <p className="text-white/60 text-xs">Por persona</p>
              <p className="text-white font-medium">
                ₡ {getPricePerPerson().toLocaleString()}
              </p>
            </div> */}
          </div>

          <div className="border-t border-white/10" />

          {/* Contact Info */}
          <div>
            <p className="text-white/60 text-xs">Reservado por</p>
            <div className="flex items-center gap-2 ">
              <p className="text-white font-medium">{nombre}</p>
              <p className="text-white/80 text-sm">({celular})</p>
            </div>
          </div>
        </div>
      </div>

      {/* SINPE Section - Only for Sabana (local == 1) */}
      {cancha.local === 1 && (
        <>
          {/* Warning Banner with Deadline - Only show if comprobante not uploaded */}
          {!reserva.sinpe_reserva && (
            <div className="px-4 mb-6">
              <div
                className={`${
                  isExpired
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-yellow-500/10 border-yellow-500/30"
                } border rounded-xl px-4 py-4`}
              >
                <div className="flex items-start gap-3">
                  <IoWarning
                    className={`${
                      isExpired ? "text-red-500" : "text-yellow-500"
                    } text-xl shrink-0 mt-0.5`}
                  />
                  <div>
                    <p className="text-white/90 text-sm">
                      {isExpired ? (
                        <>
                          <strong className="text-red-500">
                            Tiempo expirado.
                          </strong>{" "}
                          Su reserva puede ser cancelada en cualquier momento si
                          no ha subido el comprobante.
                        </>
                      ) : (
                        <>
                          Tiene hasta las{" "}
                          <strong className="text-yellow-500">
                            {deadlineTime}
                          </strong>{" "}
                          para realizar el SINPE y subir el comprobante o su
                          reserva será cancelada automáticamente.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SINPE Info */}
          <div className="px-4 mb-6">
            <h3 className="text-white font-medium mb-3">
              Datos de SINPE Móvil
            </h3>
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">A nombre de</span>
                <span className="text-white font-medium tracking-tighter">
                  Jose Tello Ferrer
                </span>
              </div>
              <div className="border-t border-white/10" />
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">Número de SINPE</span>
                <span className="text-white font-medium tracking-tighter">
                  8888-8888
                </span>
              </div>
              <div className="border-t border-white/10" />
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">
                  Monto de adelanto (50%)
                </span>
                <span className="text-white font-bold text-lg  tracking-tight">
                  ₡ {sinpeAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Upload Comprobante or Confirmation Status */}
          <div className="px-4 mb-6">
            {/* If comprobante already uploaded */}
            {reserva.sinpe_reserva ? (
              <div className="space-y-4">
                {/* Comprobante received message */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-4">
                  <div className="flex items-start gap-3">
                    <FaCheck className="text-green-500 text-lg shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">
                        Comprobante recibido
                      </p>
                      <p className="text-white/70 text-sm mt-1">
                        Hemos recibido tu comprobante. Un encargado verificará
                        tu pago.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirmation status badge */}
                {reserva.confirmada === null && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      <FiClock className="text-yellow-500 text-lg" />
                      <span className="text-yellow-500 font-medium">
                        Por confirmar
                      </span>
                    </div>
                  </div>
                )}

                {reserva.confirmada === true && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      <FaCheck className="text-green-500 text-lg" />
                      <span className="text-green-500 font-medium">
                        Reserva confirmada
                      </span>
                    </div>
                  </div>
                )}

                {/* Show uploaded image preview */}
                <div>
                  <p className="text-white/60 text-xs mb-2">
                    Comprobante subido:
                  </p>
                  <img
                    src={reserva.sinpe_reserva}
                    alt="Comprobante SINPE"
                    className="w-full max-h-64 object-contain rounded-lg border border-white/10"
                  />
                </div>
              </div>
            ) : (
              /* Upload form */
              <div>
                <h3 className="text-white font-medium mb-3">
                  Subir comprobante
                </h3>

                {/* File input area */}
                <label className="relative block w-full rounded-lg border-2 border-dashed border-white/15 p-8 text-center hover:border-white/25 focus:outline-2 focus:outline-offset-2 focus:outline-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FiUpload className="mx-auto size-12 text-gray-500" />
                  <span className="mt-2 block text-sm font-semibold text-white">
                    {selectedFile
                      ? selectedFile.name
                      : "Subir imagen del comprobante SINPE"}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {selectedFile
                      ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                      : "Toque para seleccionar o tomar foto (máx. 20MB)"}
                  </span>
                </label>

                {/* Error message */}
                {uploadError && (
                  <p className="text-red-400 text-sm mt-2">{uploadError}</p>
                )}

                {/* Upload button */}
                <button
                  onClick={handleUploadComprobante}
                  disabled={!selectedFile || uploading}
                  className={`w-full mt-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                    selectedFile && !uploading
                      ? "bg-primary text-white"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <FiUpload className="text-lg" />
                      Subir Imagen
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
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

      {/* Maps Links */}
      <div className="px-4 mb-6">
        <h3 className="text-white font-medium mb-3">¿Cómo llegar?</h3>
        <div className="flex gap-3">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <FaMapMarkerAlt className="text-red-500" />
            Google Maps
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <FaWaze className="text-cyan-400" />
            Waze
          </a>
        </div>
      </div>

      {/* Shareable Link */}
      <div className="px-4 mb-6">
        <h3 className="text-white font-medium mb-3">Enlace de la reserva</h3>
        <p className="text-gray-400 text-sm mb-3">
          Si alguien más realizará la transacción o desea volver a abrir esta
          página más tarde, puede usar este enlace:
        </p>
        <div className="flex gap-2">
          <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-white/80 text-sm truncate">
            {reservaUrl}
          </div>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <MdContentCopy />
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      {/* Cancellation Section */}
      <div className="px-4 mb-6">
        <h3 className="text-white font-medium mb-3">
          ¿Desea cancelar esta reserva?
        </h3>
        <a
          href="https://wa.me/50688888888?text=Hola,%20quisiera%20cancelar%20mi%20reserva%20con%20ID:%20"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 text-white text-base rounded-lg font-medium flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10  transition-colors"
        >
          <FaWhatsapp className="text-green-600 text-xl" />
          Enviar mensaje por WhatsApp
        </a>
        <p className="text-gray-500 text-xs text-center mt-2">
          Comuníquese con nosotros para solicitar la cancelación de su reserva
        </p>
      </div>
    </div>
  );
}

export default ReservaDetalles;
