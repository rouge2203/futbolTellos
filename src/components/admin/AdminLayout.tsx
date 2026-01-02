import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { FaUser, FaEye, FaSignOutAlt } from "react-icons/fa";
import { useState } from "react";

const navigation = [
  { name: "Reservaciones", href: "/admin", path: "/admin" },
  // { name: "Reservas", href: "/admin/reservas", path: "/admin/reservas" },
  {
    name: "Reservaciones por hora",
    href: "/admin/reservas-2",
    path: "/admin/reservas-2",
  },
  { name: "Retos", href: "/admin/retos", path: "/admin/retos" },
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
              <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
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
                        "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium"
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
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
            <div className="-mr-2 flex items-center sm:hidden">
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

        <DisclosurePanel className="sm:hidden">
          <div className="space-y-1 pt-2 pb-3">
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
                    "block border-l-4 py-2 pr-4 pl-3 text-base font-medium"
                  )}
                >
                  {item.name}
                </DisclosureButton>
              );
            })}
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
