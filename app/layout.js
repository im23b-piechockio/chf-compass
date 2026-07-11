import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "CHF Compass — Swiss Portfolio & Savings Simulator",
  description:
    "Interactive investment dashboard in Swiss francs. Build a portfolio from real assets, backtest 10 years of market data, and see what a monthly savings plan could grow into versus a Swiss savings account.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "CHF Compass",
    description:
      "Build a CHF portfolio with real market data, backtest 10 years, and simulate your savings plan against a Swiss savings account.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
