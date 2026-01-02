import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { FaUser, FaSignInAlt } from "react-icons/fa";

const navigation = [
  { name: "Inicio", href: "/", path: "/", matchPath: true },
  { name: "Sabana", href: "/?filter=sabana", path: "/", filter: "sabana" },
  {
    name: "Guadalupe",
    href: "/?filter=guadalupe",
    path: "/",
    filter: "guadalupe",
  },
  { name: "Retos 🔥", href: "/retos", path: "/retos" },
  { name: "Reservaciones", href: "/reservas-hoy", path: "/reservas-hoy" },
];

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, loading } = useAuth();

  // Helper to check if nav item is active
  const isNavActive = (item: (typeof navigation)[0]): boolean => {
    if (item.path !== location.pathname) return false;

    // For items with filter, check search params
    if (item.filter) {
      const searchParams = new URLSearchParams(location.search);
      return searchParams.get("filter") === item.filter;
    }

    // For items with matchPath (like Inicio), check if no filter is present
    if (item.matchPath) {
      const searchParams = new URLSearchParams(location.search);
      return !searchParams.get("filter");
    }

    return true;
  };

  return (
    <div className="min-h-full bg-bg">
      <Disclosure
        as="nav"
        className="sticky top-0 z-50 bg-bg/95 backdrop-blur-sm"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link
                to="/"
                className="shrink-0 flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <img
                  alt="Futbol Tello"
                  src="/tellos-square.webp"
                  className="h-6 w-auto"
                />
                <h2 className="text-white font-extrabold text-xl tracking-tight">
                  FUTBOL TELLO
                </h2>
              </Link>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {navigation.map((item) => {
                    const isCurrent = isNavActive(item);
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        aria-current={isCurrent ? "page" : undefined}
                        className={classNames(
                          isCurrent
                            ? "bg-white/5 border-white text-secondary"
                            : "text-gray-300 hover:bg-white/5 hover:text-white",
                          "rounded-md px-3 py-2 text-sm font-medium"
                        )}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                {!loading && (
                  <Link
                    to={user ? "/admin" : "/login"}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {user ? (
                      <>
                        <FaUser className="text-sm" />
                        Panel Admin
                      </>
                    ) : (
                      <>
                        <FaSignInAlt className="text-sm" />
                        Login
                      </>
                    )}
                  </Link>
                )}
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              {/* Mobile menu button */}
              <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-white/50">
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Open main menu</span>
                <Bars3Icon
                  aria-hidden="true"
                  className="block size-6 group-data-open:hidden"
                />
                <XMarkIcon
                  aria-hidden="true"
                  className="hidden size-6 group-data-open:block"
                />
              </DisclosureButton>
            </div>
          </div>
        </div>

        <DisclosurePanel className="md:hidden">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
            {navigation.map((item) => {
              const isCurrent = isNavActive(item);
              return (
                <DisclosureButton
                  key={item.name}
                  as={Link}
                  to={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={classNames(
                    isCurrent
                      ? "bg-primary text-white"
                      : "text-gray-300 hover:bg-white/5 hover:text-white",
                    "block rounded-md px-3 py-2 text-base font-medium"
                  )}
                >
                  {item.name}
                </DisclosureButton>
              );
            })}
          </div>
          <div className="border-t border-white/10 pt-4 pb-3">
            <div className="px-5">
              {!loading && (
                <DisclosureButton
                  as={Link}
                  to={user ? "/admin" : "/login"}
                  className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {user ? (
                    <>
                      <FaUser className="text-sm" />
                      Panel Administrativo
                    </>
                  ) : (
                    <>
                      <FaSignInAlt className="text-sm" />
                      Iniciar Sesión
                    </>
                  )}
                </DisclosureButton>
              )}
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      <main>
        <div className="mx-auto max-w-7xl ">{children}</div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/10 bg-bg">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm text-white/60 flex items-center gap-2">
              Built by{" "}
              <a
                href="https://lobsterlabs.net"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-white hover:text-white/80 font-bold text-lg transition-colors"
                style={{ fontFamily: "Varien, sans-serif" }}
              >
                LOBSTER LABS
                <img
                  src="https://mafisa-group-assets.nyc3.cdn.digitaloceanspaces.com/lobster/lobsterLogo.png"
                  alt="Lobster Labs"
                  className="size-5 mb-1"
                />
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
