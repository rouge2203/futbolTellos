import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ImageSlideshow from "../components/ImageSlideshow";
import { TiLocationArrowOutline } from "react-icons/ti";
import { TiLocationArrow } from "react-icons/ti";
import { TbSoccerField } from "react-icons/tb";
import { MdLocationOn } from "react-icons/md";
import { TbPlayFootball, TbRun } from "react-icons/tb";
import { LiaMoneyBillWaveSolid } from "react-icons/lia";
import { FaRegCalendarCheck } from "react-icons/fa";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

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
  const [searchParams] = useSearchParams();
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read filter from URL params: sabana → 1, guadalupe → 2, no param → null
  const getFilterFromParams = (): number | null => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "sabana") return 1;
    if (filterParam === "guadalupe") return 2;
    return null;
  };

  const [filter, setFilter] = useState<number | null>(getFilterFromParams()); // null = all, 1 = Sabana, 2 = Guadalupe

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

  // Update filter when URL params change
  useEffect(() => {
    setFilter(getFilterFromParams());
  }, [searchParams]);

  // Filter canchas based on selected filter
  const filteredCanchas =
    filter === null
      ? canchas
      : canchas.filter((cancha) => cancha.local === filter);

  // Separate canchas by location for desktop view
  const sabanaCanchas = canchas.filter((cancha) => cancha.local === 1);
  const guadalupeCanchas = canchas.filter((cancha) => cancha.local === 2);

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

  // Hero carousel state for desktop
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  // Auto-advance hero carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % bannerImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [bannerImages.length]);

  const goToPreviousHero = () => {
    setCurrentHeroIndex((prev) =>
      prev === 0 ? bannerImages.length - 1 : prev - 1
    );
  };

  const goToNextHero = () => {
    setCurrentHeroIndex((prev) => (prev + 1) % bannerImages.length);
  };

  return (
    <div className="min-h-full bg-bg px-4 py-6 sm:px-6 lg:px-8">
      {/* Mobile: Carousel */}
      <div className="mb-4 lg:hidden">
        <ImageSlideshow images={bannerImages} interval={3000} />
      </div>

      {/* Desktop: Hero Carousel */}
      <div className="hidden lg:block mb-12 relative">
        <div className="relative w-full h-[600px] rounded-4xl overflow-hidden">
          {/* Images */}
          <div className="relative w-full h-full">
            {bannerImages.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentHeroIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <img
                  src={image}
                  alt={`Banner ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goToPreviousHero}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeftIcon className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={goToNextHero}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors"
            aria-label="Next image"
          >
            <ChevronRightIcon className="h-6 w-6 text-white" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {bannerImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentHeroIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentHeroIndex
                    ? "w-8 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
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
          {/* Desktop: Separated Sections */}
          <div className="hidden lg:block">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {/* Sabana Section */}
              {sabanaCanchas.length > 0 &&
                (filter === null || filter === 1) && (
                  <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                      <TiLocationArrow className="text-3xl text-primary" />
                      <h2 className="text-3xl font-bold text-white">Sabana</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 xl:gap-x-8">
                      {sabanaCanchas.map((cancha) => (
                        <div
                          key={cancha.id}
                          className="group relative bg-white rounded-4xl shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <div className="p-4">
                            <div className="aspect-square w-full overflow-hidden bg-gray-100 rounded-xl relative">
                              {cancha.img ? (
                                <>
                                  <img
                                    src={cancha.img}
                                    alt={cancha.nombre}
                                    className="h-full w-full object-cover object-center rounded-4xl group-hover:scale-105 transition-transform duration-500"
                                  />
                                  {/* Badges inside image */}
                                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                                    {/* Location badge */}
                                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                                      <MdLocationOn className="h-4 w-4 text-secondary" />
                                      <span className="text-xs font-semibold text-gray-900">
                                        {getLocalName(cancha.local)}
                                      </span>
                                    </div>
                                    {/* Price badge */}
                                    {cancha.precio && (
                                      <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                                        <LiaMoneyBillWaveSolid className="h-4 w-4 text-secondary" />
                                        <span className="text-xs font-semibold text-gray-900">
                                          ₡{formatPrecio(cancha.precio)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center rounded-xl">
                                  <TbSoccerField className="h-16 w-16 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-5 pb-5 flex flex-col">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                              {cancha.nombre}
                            </h3>
                            <p className="text-sm text-gray-500 mb-2">
                              {getLocalName(cancha.local)}
                            </p>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {cancha.id === 6
                                ? "Cancha de fútbol 7-8-9 vs 7-8-9"
                                : `Cancha de fútbol ${cancha.cantidad} vs ${cancha.cantidad}`}
                            </p>
                            <div className="flex items-center justify-between mt-auto">
                              {cancha.precio && (
                                <div className="bg-gray-100 rounded-full px-4 py-1.5">
                                  <span className="text-sm font-semibold text-gray-900">
                                    ₡{formatPrecio(cancha.precio)}
                                  </span>
                                </div>
                              )}
                              <button
                                onClick={() => handleReservar(cancha.id)}
                                className="bg-gray-900 hover:bg-gray-800 rounded-full px-5 py-2 text-sm font-medium text-white transition-colors flex items-center gap-2"
                              >
                                <span>Reservar</span>
                                <FaRegCalendarCheck className="h-4 w-4 text-secondary" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              {/* Guadalupe Section */}
              {guadalupeCanchas.length > 0 &&
                (filter === null || filter === 2) && (
                  <section>
                    <div className="flex items-center gap-3 mb-8">
                      <TiLocationArrow className="text-3xl text-primary" />
                      <h2 className="text-3xl font-bold text-white">
                        Guadalupe
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 xl:gap-x-8">
                      {guadalupeCanchas.map((cancha) => (
                        <div
                          key={cancha.id}
                          className="group relative bg-white rounded-4xl shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <div className="p-4">
                            <div className="aspect-square w-full overflow-hidden bg-gray-100 rounded-xl relative">
                              {cancha.img ? (
                                <>
                                  <img
                                    src={cancha.img}
                                    alt={cancha.nombre}
                                    className="h-full w-full object-cover object-center rounded-xl group-hover:scale-105 transition-transform duration-500"
                                  />
                                  {/* Badges inside image */}
                                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                                    {/* Location badge */}
                                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                                      <MdLocationOn className="h-4 w-4 text-primary" />
                                      <span className="text-xs font-semibold text-gray-900">
                                        {getLocalName(cancha.local)}
                                      </span>
                                    </div>
                                    {/* Price badge */}
                                    {cancha.precio && (
                                      <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                                        <LiaMoneyBillWaveSolid className="h-4 w-4 text-secondary" />
                                        <span className="text-xs font-semibold text-gray-900">
                                          ₡{formatPrecio(cancha.precio)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center rounded-xl">
                                  <TbSoccerField className="h-16 w-16 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-5 pb-5 flex flex-col">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                              {cancha.nombre}
                            </h3>
                            <p className="text-sm text-gray-500 mb-2">
                              {getLocalName(cancha.local)}
                            </p>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {cancha.id === 6
                                ? "Cancha de fútbol 7-8-9 vs 7-8-9"
                                : `Cancha de fútbol ${cancha.cantidad} vs ${cancha.cantidad}`}
                            </p>
                            <div className="flex items-center justify-between mt-auto">
                              {cancha.precio && (
                                <div className="bg-gray-100 rounded-full px-4 py-1.5">
                                  <span className="text-sm font-semibold text-gray-900">
                                    ₡{formatPrecio(cancha.precio)}
                                  </span>
                                </div>
                              )}
                              <button
                                onClick={() => handleReservar(cancha.id)}
                                className="bg-gray-900 hover:bg-gray-800 rounded-full px-5 py-2 text-sm font-medium text-white transition-colors flex items-center gap-2"
                              >
                                <span>Reservar</span>
                                <FaRegCalendarCheck className="h-4 w-4 text-secondary" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
            </div>
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
