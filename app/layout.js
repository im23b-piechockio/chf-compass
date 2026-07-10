import "./globals.css";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
