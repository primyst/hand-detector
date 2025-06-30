import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QUDUS Hand AI ✋",
  description: "Real-time hand detection with TensorFlow.js + Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
