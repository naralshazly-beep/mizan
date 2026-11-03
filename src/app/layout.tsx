import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "بصمة",
  description: "ابحث باليوزرنيم أو الاسم أو الصورة في المصادر العامة.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${arabic.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Nav />
        {children}
      </body>
    </html>
  );
}
