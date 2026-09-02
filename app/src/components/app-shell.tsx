"use client";

import {
  CalendarDays,
  Home,
  House,
  ShoppingCart,
  Wifi,
} from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  {
    href: "/",
    label: "Dashboard",
    icon: Home,
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
  },
  {
    href: "/shopping",
    label: "Shopping",
    icon: ShoppingCart,
  },
];

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <House size={20} strokeWidth={2.2} />
          </div>

          <div className="brand-copy">
            <strong>Family Hub</strong>
            <span>Amod family</span>
          </div>
        </div>

        <nav className="desktop-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${
                  active ? "nav-item-active" : ""
                }`}
              >
                <Icon size={19} strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Wifi size={14} />
          <span>Family Hub online</span>
          <span className="status-dot" />
        </div>
      </aside>

      <main className="app-main">
        {children}
      </main>

      <nav className="mobile-nav">
        {navigation.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${
                active ? "mobile-nav-active" : ""
              }`}
            >
              <Icon size={21} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
