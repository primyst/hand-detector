"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandDetector } from "@/components/HandDetector";

export default function Home() {
  const [name, setName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && matricNumber.trim()) {
      setSubmitted(true);
    }
  };

  const handleDetectionComplete = () => {
    router.push("/success");
  };

  if (submitted) {
    return (
      <HandDetector
        name={name}
        matricNumber={matricNumber}
        onComplete={handleDetectionComplete}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto space-y-4">
      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="text"
        placeholder="Matric Number"
        value={matricNumber}
        onChange={(e) => setMatricNumber(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Continue to Hand Detection
      </button>
    </form>
  );
}