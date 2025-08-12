"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HandDetector from "@/components/HandDetector";
import { supabase } from "@/lib/supabaseClient";

export default function Page() {
  const [name, setName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [startDetection, setStartDetection] = useState(false);
  const router = useRouter();

  async function logAttendance(userIdentifier: string) {
    const { error } = await supabase
      .from("attendance")
      .insert([{ user_identifier: userIdentifier }]);

    if (error) {
      console.error("Error saving attendance:", error.message);
    } else {
      console.log("Attendance saved successfully");
      router.push("/success");
    }
  }

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
          onHandDetected={() =>
            logAttendance(`${name} - ${matricNumber}`)
          }
        />
      )}
    </div>
  );
}