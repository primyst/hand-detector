"use client";

import { useSearchParams } from "next/navigation";

export default function ClientSuccess() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "Guest";
  const matricNumber = searchParams.get("matricNumber") || "Unknown";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold text-green-600">✅ Detection Successful!</h1>
      <p className="mt-2 text-lg">Well done, {name}!</p>
      <p className="text-gray-600">Matric Number: {matricNumber}</p>
      <a
        href="/"
        className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Go Back Home
      </a>
    </div>
  );
}