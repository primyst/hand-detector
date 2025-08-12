"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HandDetector from "@/components/HandDetector";

export default function Page() {
  const [name, setName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [startDetection, setStartDetection] = useState(false);
  const router = useRouter();

  return (
    <div className="p-6 max-w-md mx-auto">
      {!startDetection ? (
        <div className="space-y-4">
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
            onClick={() => setStartDetection(true)}
            className="w-full bg-blue-500 text-white py-2 rounded"
          >
            Next: Hand Detector
          </button>
        </div>
      ) : (
        <HandDetector
          name={name}
          matricNumber={matricNumber}
          onComplete={() => router.push("/success")}
        />
      )}
    </div>
  );
}