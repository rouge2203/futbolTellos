import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ImageSlideshow from "../components/ImageSlideshow";
import { TiLocationArrowOutline } from "react-icons/ti";
import { TiLocationArrow } from "react-icons/ti";
import { TbSoccerField } from "react-icons/tb";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { LiaMoneyBillWaveSolid } from "react-icons/lia";
import { FaRegCalendarCheck } from "react-icons/fa";
import { BentoGrid, BentoGridItem } from "../components/ui/bento-grid";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  cantidad: string;
  local: number;
  precio?: string; // varchar like "23.000" (period as thousands separator)
}

// Parse precio string "23.000" -> 23000 (period is thousands separator)
const parsePrecio = (precioStr: string | undefined): number => {
  if (!precioStr) return 0;
  return parseInt(precioStr.replace(/\./g, ""), 10) || 0;
};

// Format precio for display - handles ranges like "40.000-50.000"
const formatPrecio = (precioStr: string | undefined): string => {
  if (!precioStr) return "0";

  // Check if it's a range (contains "-")
  if (precioStr.includes("-")) {
    const parts = precioStr.split("-");
    const formattedParts = parts.map((part) => {
      const num = parseInt(part.replace(/\./g, ""), 10) || 0;
      return num.toLocaleString();
    });
    return formattedParts.join(" - ");
  }

  // Single price
  return parsePrecio(precioStr).toLocaleString();
};

function Index() {
  const navigate = useNavigate();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | null>(null); // null = all, 1 = Sabana, 2 = Guadalupe

  const fetchCanchas = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("canchas")
        .select("*");

      if (fetchError) {
        throw fetchError;
      }

      setCanchas(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch canchas");
      console.error("Error fetching canchas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load canchas automatically on mount
  useEffect(() => {
    fetchCanchas();
  }, []);

  // Filter canchas based on selected filter
  const filteredCanchas =
    filter === null
      ? canchas
      : canchas.filter((cancha) => cancha.local === filter);

  const getLocalName = (local: number): string => {
    if (local === 1) return "Sabana";
    if (local === 2) return "Guadalupe";
    return `unknown (${local})`;
  };

  const handleReservar = (canchaId: number) => {
    navigate(`/cancha/${canchaId}`);
  };

  const bannerImages = [
    "/banner-tello.webp",
    "/banner-sabana.webp",
    "/banner-guadalupe.webp",
  ];

  return (
    <div className="min-h-full bg-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <ImageSlideshow images={bannerImages} interval={3000} />
      </div>
      {/* <h1 className="text-4xl font-bold text-center text-white mb-4">
        Welcome to Futbol Tellos
      </h1>
      <p className="text-gray-300 text-lg mb-6">This is the home page.</p> */}

      {/* Filter Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center mb-4 px-0 sm:px-0">
        {/* Mobile: Sabana and Guadalupe in a row */}
        <div className="flex gap-2 sm:hidden">
          <button
            onClick={() => setFilter(filter === 1 ? null : 1)}
            className={`px-3 py-3 rounded-md tracking-tight text-white text-xl font-bold transition-colors flex items-center justify-center gap-0.5 flex-1 border-primary  border border-dashed ${
              filter === 1 ? "bg-primary" : "bg-transparent  "
            }`}
          >
            {filter === 1 ? (
              <TiLocationArrow className="text-2xl shrink-0" />
            ) : (
              <TiLocationArrowOutline className="text-xl shrink-0" />
            )}
            <span className="truncate">SABANA</span>
          </button>
          <button
            onClick={() => setFilter(filter === 2 ? null : 2)}
            className={`px-3 py-3 rounded-md tracking-tight  text-white text-xl font-bold transition-colors flex items-center justify-center gap-0.5 flex-1 border-primary border border-dashed ${
              filter === 2 ? "bg-primary" : "bg-transparent  "
            }`}
          >
            {filter === 2 ? (
              <TiLocationArrow className="text-2xl shrink-0" />
            ) : (
              <TiLocationArrowOutline className="text-xl shrink-0" />
            )}
            <span className="truncate">GUADALUPE</span>
          </button>
        </div>

        {/* Mobile: Todas button below */}
        {/* <button
          onClick={() => setFilter(null)}
          className={`sm:hidden px-3 py-2 w-2/3 mt-1 self-center rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-1.5 ${
            filter === null ? "bg-primary" : "bg-primary/50 hover:bg-primary/70"
          }`}
        >
          <TbSoccerField className="text-lg shrink-0" />
          <span className="truncate">Todas las canchas</span>
        </button> */}
      </div>

      {loading && (
        <div className="text-center text-white mb-4">Cargando...</div>
      )}

      {error && (
        <div className="text-red-400 mb-4 p-4 bg-red-900/20 rounded-lg">
          Error: {error}
        </div>
      )}

      {filteredCanchas.length > 0 && (
        <>
          {/* Desktop: Bento Grid */}
          <div className="hidden lg:block">
            <BentoGrid className="max-w-7xl mx-auto">
              {filteredCanchas.slice(0, 5).map((cancha, i) => (
                <BentoGridItem
                  key={cancha.id}
                  title={
                    <div className="flex items-center gap-2">
                      <TbSoccerField className="h-5 w-5 text-primary" />
                      <span>{cancha.nombre}</span>
                    </div>
                  }
                  description={
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-white/80">
                        <MdLocationOn className="h-4 w-4 text-primary" />
                        <span className="text-sm capitalize">
                          {getLocalName(cancha.local)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <TbPlayFootball className="h-4 w-4 text-primary" />
                        <span className="text-sm">{cancha.cantidad} Fut</span>
                      </div>
                      {cancha.precio && (
                        <div className="flex items-center gap-2 text-white/80">
                          <LiaMoneyBillWaveSolid className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">
                            ₡{formatPrecio(cancha.precio)}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => handleReservar(cancha.id)}
                        className="w-full mt-3 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <FaRegCalendarCheck className="h-4 w-4" />
                        Reservar
                      </button>
                    </div>
                  }
                  header={
                    cancha.img ? (
                      <div className="relative flex flex-1 w-full h-full min-h-24 rounded-xl overflow-hidden group">
                        <img
                          src={cancha.img}
                          alt={cancha.nombre}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleReservar(cancha.id)}
                          className="absolute top-2 right-2 p-2 bg-primary/90 hover:bg-primary text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
                        >
                          <FaRegCalendarCheck className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 w-full h-full min-h-24 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800"></div>
                    )
                  }
                  icon={<TbSoccerField className="h-4 w-4 text-primary" />}
                  className={i === 3 || i === 6 ? "md:col-span-2" : ""}
                />
              ))}
            </BentoGrid>
          </div>

          {/* Mobile/Tablet: Regular Grid */}
          <div className="lg:hidden w-full  grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCanchas.map((cancha) => (
              <div
                key={cancha.id}
                className="bg-gray-700/10 border-2 border-double border-primary shadow-primary  rounded-2xl overflow-hidden shadow-md"
              >
                {/* Image with reservar icon */}
                {cancha.img && (
                  <div className="relative w-full h-56  px-3 py-4  group ">
                    <img
                      src={cancha.img}
                      alt={cancha.nombre}
                      className="w-full h-full object-cover rounded-2xl "
                    />
                    <button
                      onClick={() => handleReservar(cancha.id)}
                      className="absolute top-6 right-6 p-2.5 bg-bg hover:bg-primary text-secondary rounded-full transition-all shadow-lg"
                    >
                      <FaRegCalendarCheck className="size-4" />
                    </button>
                  </div>
                )}

                {/* Content */}
                <div className="px-4 -mt-3 space-y-0.25">
                  {/* Name */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium tracking-tight text-white">
                      {cancha.nombre}
                    </h2>
                    {/* Location */}
                    <div className="flex gap-0.5 items-center">
                      <MdLocationOn className="text-xs text-secondary " />
                      <h2 className="text-sm text-white underline underline-offset-2">
                        {getLocalName(cancha.local)}
                      </h2>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center justify-between ">
                    {/* Fut */}
                    <div className="flex items-center gap-1 text-white/80">
                      <div className="flex items-center">
                        <TbRun className="text-sm text-secondary" />
                        <TbPlayFootball className="text-sm text-secondary -ml-0.5" />
                      </div>
                      <span className="text-sm font-bold">
                        FUT {cancha.cantidad}
                      </span>
                    </div>
                    {/* Price */}
                    {cancha.precio && (
                      <div className="flex items-center gap-2 text-white/80 -mt-1">
                        {/* <LiaMoneyBillWaveSolid className="h-4 w-4 text-primary shrink-0" /> */}
                        <span className="text-sm font-bold">
                          ₡ {formatPrecio(cancha.precio)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reservar Button */}
                  <div className="w-full flex justify-end mb-4 mt-2">
                    <button
                      onClick={() => handleReservar(cancha.id)}
                      className="w-2/5 py-3 px-2 bg-primary text-white font-medium justify-center items-center text-center text-base  flex gap-2 rounded-lg "
                    >
                      <FaRegCalendarCheck className="text-base" />
                      Reservar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && filteredCanchas.length === 0 && canchas.length > 0 && (
        <div className="text-center text-gray-400 mb-4">
          No canchas found for the selected filter.
        </div>
      )}
    </div>
  );
}

export default Index;
