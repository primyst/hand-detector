"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import HandDetector from "@/components/HandDetector";

export default function Home() {
  const [name, setName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [startDetection, setStartDetection] = useState(false);
  const router = useRouter();

  const handleDetectionComplete = () => {
    // Redirect to success with query params
    router.push(`/success?name=${encodeURIComponent(name)}&matricNumber=${encodeURIComponent(matricNumber)}`);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      {!startDetection ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && matricNumber.trim()) {
              setStartDetection(true);
            }
          }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="text"
            placeholder="Matric Number"
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
          <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded">
            Next: Hand Detector
          </button>
        </form>
      ) : (
        <HandDetector
          name={name}
          matricNumber={matricNumber}
          onComplete={handleDetectionComplete}
        />
      )}
    </div>
  );
}