import type { Metadata } from "next";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/pulse/theme.css";
import "@fullcalendar/react/themes/pulse/palettes/blue.css";
import "./globals.css";

import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Family Hub",
  description: "Our family calendar and home hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
