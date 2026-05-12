import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import {
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { FaUser, FaEye, FaSignOutAlt } from "react-icons/fa";
import { useState } from "react";

const reservacionesItems = [
  {
    name: "Reservaciones",
    href: "/admin",
    path: "/admin",
    description: "Gestión completa de reservaciones individuales",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
        />
      </svg>
    ),
  },
  {
    name: "Reservaciones por hora",
    href: "/admin/reservas-2",
    path: "/admin/reservas-2",
    description: "Vista organizada por horarios del día",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  {
    name: "Reservaciones Fijas",
    href: "/admin/reservas-fijas",
    path: "/admin/reservas-fijas",
    description: "Reservaciones recurrentes semanales",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    ),
  },
];

const tiendaItems = [
  {
    name: "Ventas",
    href: "/admin/tienda",
    path: "/admin/tienda",
    description: "Dashboard de ventas y analíticas",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
        />
      </svg>
    ),
  },
  {
    name: "Productos",
    href: "/admin/tienda/productos",
    path: "/admin/tienda/productos",
    description: "Catálogo de productos disponibles",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
        />
      </svg>
    ),
  },
  {
    name: "Inventario",
    href: "/admin/tienda/inventario",
    path: "/admin/tienda/inventario",
    description: "Control de stock por ubicación",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
        />
      </svg>
    ),
  },
  {
    name: "Ubicaciones",
    href: "/admin/tienda/ubicaciones",
    path: "/admin/tienda/ubicaciones",
    description: "Gestión de puntos de venta",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-6 text-gray-600 group-hover:text-primary"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
        />
      </svg>
    ),
  },
];

const navigation = [
  { name: "Retos", href: "/admin/retos", path: "/admin/retos" },
  { name: "Pagos", href: "/admin/pagos", path: "/admin/pagos" },
  { name: "Canchas", href: "/admin/canchas", path: "/admin/canchas" },
  {
    name: "Horarios",
    href: "/admin/configuracion",
    path: "/admin/configuracion",
  },
];

const userNavigation = [
  { name: "Vista Clientes", href: "/", icon: FaEye },
  { name: "Cerrar sesión", href: "#", action: "signout", icon: FaSignOutAlt },
];

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleNavClick = async (item: { href: string; action?: string }) => {
    if (item.action === "signout") {
      setSigningOut(true);
      try {
        await signOut();
        // Smooth redirect to login page
        navigate("/admin/login", { replace: true });
      } catch (error) {
        console.error("Error signing out:", error);
        setSigningOut(false);
      }
    }
  };

  return (
    <div className="min-h-full bg-gray-100">
      <Disclosure as="nav" className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex shrink-0 items-center">
                <Link to="/admin" className="flex items-center gap-2">
                  <img
                    alt="Futbol Tello"
                    src="/tellos-square.svg"
                    className="h-8 w-auto"
                  />
                  <span className="font-extrabold tracking-tight text-black text-xl">
                    FUTBOL TELLO
                  </span>
                </Link>
              </div>
              <div className="hidden lg:-my-px lg:ml-6 lg:flex lg:space-x-8 lg:items-stretch">
                {/* Reservaciones Dropdown */}
                <Menu as="div" className="relative flex items-stretch">
                  {() => {
                    const isReservacionesActive = reservacionesItems.some(
                      (item) => location.pathname === item.path,
                    );
                    return (
                      <>
                        <MenuButton
                          className={classNames(
                            isReservacionesActive
                              ? "border-primary text-gray-900"
                              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                            "inline-flex items-center gap-x-1 border-b-2 px-1 text-sm font-medium",
                          )}
                        >
                          <span>Reservaciones</span>
                          <ChevronDownIcon
                            aria-hidden="true"
                            className="size-4"
                          />
                        </MenuButton>
                        <MenuItems
                          transition
                          className="absolute left-0 z-10 mt-17 w-screen max-w-md origin-top-left rounded-3xl bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
                        >
                          <div className="p-4">
                            {reservacionesItems.map((item) => {
                              const isCurrent = location.pathname === item.path;
                              return (
                                <MenuItem key={item.name}>
                                  <div className="group relative flex gap-x-6 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-white">
                                      {item.icon}
                                    </div>
                                    <div>
                                      <Link
                                        to={item.href}
                                        className={classNames(
                                          isCurrent
                                            ? "text-primary"
                                            : "text-gray-900",
                                          "font-semibold",
                                        )}
                                      >
                                        {item.name}
                                        <span className="absolute inset-0"></span>
                                      </Link>
                                      <p className="mt-1 text-gray-600 text-sm">
                                        {item.description}
                                      </p>
                                    </div>
                                  </div>
                                </MenuItem>
                              );
                            })}
                          </div>
                        </MenuItems>
                      </>
                    );
                  }}
                </Menu>

                {/* Other Navigation Items */}
                {navigation.map((item) => {
                  const isCurrent = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      aria-current={isCurrent ? "page" : undefined}
                      className={classNames(
                        isCurrent
                          ? "border-primary text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                        "inline-flex items-center border-b-2 px-1 text-sm font-medium",
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                {/* Tienda Dropdown */}
                <Menu as="div" className="relative flex items-stretch">
                  {() => {
                    const isTiendaActive = tiendaItems.some(
                      (item) => location.pathname === item.path,
                    );
                    return (
                      <>
                        <MenuButton
                          className={classNames(
                            isTiendaActive
                              ? "border-primary text-gray-900"
                              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                            "inline-flex items-center gap-x-1 border-b-2 px-1 text-sm font-medium",
                          )}
                        >
                          <span>Tienda</span>
                          <ChevronDownIcon
                            aria-hidden="true"
                            className="size-4"
                          />
                        </MenuButton>
                        <MenuItems
                          transition
                          className="absolute left-0 z-10 mt-17 w-screen max-w-md origin-top-left rounded-3xl bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-none data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
                        >
                          <div className="p-4">
                            {tiendaItems.map((item) => {
                              const isCurrent = location.pathname === item.path;
                              return (
                                <MenuItem key={item.name}>
                                  <div className="group relative flex gap-x-6 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-white">
                                      {item.icon}
                                    </div>
                                    <div>
                                      <Link
                                        to={item.href}
                                        className={classNames(
                                          isCurrent
                                            ? "text-primary"
                                            : "text-gray-900",
                                          "font-semibold",
                                        )}
                                      >
                                        {item.name}
                                        <span className="absolute inset-0"></span>
                                      </Link>
                                      <p className="mt-1 text-gray-600 text-sm">
                                        {item.description}
                                      </p>
                                    </div>
                                  </div>
                                </MenuItem>
                              );
                            })}
                          </div>
                        </MenuItems>
                      </>
                    );
                  }}
                </Menu>
              </div>
            </div>
            <div className="hidden lg:ml-6 lg:flex lg:items-center">
              {/* Profile dropdown */}
              <Menu as="div" className="relative ml-3">
                <MenuButton className="relative flex max-w-xs items-center rounded-full bg-white text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">Open user menu</span>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100">
                    <FaUser className="text-gray-600" />
                    <span className="text-gray-700 text-sm font-medium">
                      {user?.email?.split("@")[0] || "Admin"}
                    </span>
                  </div>
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
                >
                  {/* Profile info */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="text-sm font-medium text-gray-800">
                      {user?.email?.split("@")[0] || "Admin"}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </div>
                  </div>

                  {/* Menu items */}
                  {userNavigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <MenuItem key={item.name}>
                        {item.action === "signout" ? (
                          <button
                            onClick={() => handleNavClick(item)}
                            disabled={signingOut}
                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {Icon && <Icon className="size-4" />}
                            <span>
                              {signingOut ? "Cerrando sesión..." : item.name}
                            </span>
                          </button>
                        ) : (
                          <Link
                            to={item.href}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            {Icon && <Icon className="size-4" />}
                            <span>{item.name}</span>
                          </Link>
                        )}
                      </MenuItem>
                    );
                  })}
                </MenuItems>
              </Menu>
            </div>
            <div className="-mr-2 flex items-center lg:hidden">
              {/* Mobile menu button */}
              <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-primary">
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

        <DisclosurePanel className="lg:hidden">
          <div className="space-y-1 pt-2 pb-3">
            {/* Mobile: All reservaciones items shown separately */}
            {reservacionesItems.map((item) => {
              const isCurrent = location.pathname === item.path;
              return (
                <DisclosureButton
                  key={item.name}
                  as={Link}
                  to={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={classNames(
                    isCurrent
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                    "block border-l-4 py-2 pr-4 pl-3 text-base font-medium",
                  )}
                >
                  {item.name}
                </DisclosureButton>
              );
            })}
            {/* Other navigation items */}
            {navigation.map((item) => {
              const isCurrent = location.pathname === item.path;
              return (
                <DisclosureButton
                  key={item.name}
                  as={Link}
                  to={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={classNames(
                    isCurrent
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                    "block border-l-4 py-2 pr-4 pl-3 text-base font-medium",
                  )}
                >
                  {item.name}
                </DisclosureButton>
              );
            })}
            {/* Tienda items */}
            <div className="border-t border-gray-200 mt-1 pt-1">
              <span className="block px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Tienda
              </span>
              {tiendaItems.map((item) => {
                const isCurrent = location.pathname === item.path;
                return (
                  <DisclosureButton
                    key={item.name}
                    as={Link}
                    to={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={classNames(
                      isCurrent
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800",
                      "block border-l-4 py-2 pr-4 pl-3 text-base font-medium",
                    )}
                  >
                    {item.name}
                  </DisclosureButton>
                );
              })}
            </div>
          </div>
          <div className="-mt-3  space-y-1">
            {userNavigation.map((item) => {
              const Icon = item.icon;
              return item.action === "signout" ? (
                <DisclosureButton
                  key={item.name}
                  as="button"
                  onClick={() => handleNavClick(item)}
                  disabled={signingOut}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {Icon && <Icon className="size-4" />}
                  <span>{signingOut ? "Cerrando sesión..." : item.name}</span>
                </DisclosureButton>
              ) : (
                <DisclosureButton
                  key={item.name}
                  as={Link}
                  to={item.href}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                >
                  {Icon && <Icon className="size-4" />}
                  <span>{item.name}</span>
                </DisclosureButton>
              );
            })}
          </div>
          <div className="border-t border-gray-200 pt-4 pb-3">
            <div className="flex items-center px-4">
              <div className="shrink-0">
                <div className="size-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <FaUser className="text-gray-600" />
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {user?.email?.split("@")[0] || "Admin"}
                </div>
                <div className="text-sm font-medium text-gray-500">
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      <div className="py-6">
        {title && (
          <header>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {title}
              </h1>
            </div>
          </header>
        )}
        <main>
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
