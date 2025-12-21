import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  { name: "Home", href: "/", path: "/" },
  { name: "About", href: "/about", path: "/about" },
];

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-full bg-bg">
      <Disclosure as="nav" className="bg-bg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center gap-1.5">
                <img
                  alt="Futbol Tello"
                  src="/tellos-square.webp"
                  className="h-6 w-auto"
                />
                <h2 className="text-white font-extrabold text-xl tracking-tight">
                  FUTBOL TELLO
                </h2>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {navigation.map((item) => {
                    const isCurrent = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        aria-current={isCurrent ? "page" : undefined}
                        className={classNames(
                          isCurrent
                            ? "bg-gray-900 text-white"
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
                <span className="text-white font-medium">Futbol Tello</span>
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              {/* Mobile menu button */}
              <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-indigo-500">
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Open main menu</span>
                <Bars3Icon
                  aria-hidden="true"
                  className="block size-6 group-data-[open]:hidden"
                />
                <XMarkIcon
                  aria-hidden="true"
                  className="hidden size-6 group-data-[open]:block"
                />
              </DisclosureButton>
            </div>
          </div>
        </div>

        <DisclosurePanel className="md:hidden">
          <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
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
                      ? "bg-gray-900 text-white"
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
            <div className="flex items-center px-5">
              <div className="shrink-0">
                <img
                  alt="Futbol Tello"
                  src="/tellos-square.webp"
                  className="size-10 rounded-full outline -outline-offset-1 outline-white/10"
                />
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-white">
                  Futbol Tello
                </div>
              </div>
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      <main>
        <div className="mx-auto max-w-7xl ">{children}</div>
      </main>
    </div>
  );
}
