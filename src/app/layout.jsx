import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: "answerit — quiz en direct",
  description:
    "Lancez des quiz en direct : un code, un pseudo, et c'est parti. Sans inscription.",
};

export const viewport = {
  themeColor: "#15122b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
