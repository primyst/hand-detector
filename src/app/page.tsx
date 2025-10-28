"use client";
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as handpose from "@tensorflow-models/handpose";
import { students as allStudents } from "@/data/students";

interface Student {
  name: string;
  matricNumber: string;
  status: "Present" | "Absent";
}

export default function AttendanceDashboard() {
  // --- CONFIG: the two fake profiles in the exact order you want ---
  const fakeProfiles: Student[] = [
    { name: "Elegunde Oluwaseun", matricNumber: "LAU200002", status: "Absent" },
    { name: "Abdulraheem Uthman", matricNumber: "LAU200001", status: "Absent" },
  ];

  // Full student list (kept for CSV / table). We'll update only the two when marked.
  const [studentList, setStudentList] = useState<Student[]>(
    allStudents.map((s) => ({ ...s, status: "Absent" as Student["status"] }))
  );

  // index into fakeProfiles (0 = first fake, 1 = second fake). After both done, flow ends.
  const [currentFakeIndex, setCurrentFakeIndex] = useState<number>(0);
  // whether overlay profile card is visible (when hand detected)
  const [overlayVisible, setOverlayVisible] = useState<boolean>(false);
  // which fake name was detected (derived from currentFakeIndex)
  const [detectedName, setDetectedName] = useState<string>("");
  // track which fake profiles have been marked in this session
  const [markedMap, setMarkedMap] = useState<Record<string, boolean>>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [status, setStatus] = useState<string>("Idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // LOAD model
  useEffect(() => {
    async function loadModel() {
      try {
        setStatus("⏳ Loading model...");
        await tf.setBackend("webgl");
        await tf.ready();
        const loaded = await handpose.load();
        setModel(loaded);
        setStatus("✅ Model loaded. Ready.");
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("❌ Failed to load model.");
      }
    }
    loadModel();
  }, []);

  // Setup camera helper
  async function setupCamera(): Promise<HTMLVideoElement> {
    setStatus("📷 Requesting camera...");
    const video = videoRef.current!;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(() => {
          setStatus("▶️ Video started.");
          resolve(video);
        });
      };
    });
  }

  // MAIN detection loop - only triggers overlay for the current fake profile
  useEffect(() => {
    if (!isRunning || !model) return;
    let rafId: number;
    runningRef.current = true;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    async function detectLoop() {
      if (!runningRef.current || !model) return;

      // make sure canvas matches video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const predictions = await model.estimateHands(video, true);

      // Only consider detection if we still have fake profiles to handle
      if (currentFakeIndex < fakeProfiles.length) {
        const currentFake = fakeProfiles[currentFakeIndex];

        if (predictions.length > 0) {
          // Draw landmarks (visual)
          predictions.forEach((hand) => {
            hand.landmarks.forEach(([x, y]) => {
              ctx.beginPath();
              ctx.arc(x, y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "#00ffcc";
              ctx.shadowColor = "#00ffcc";
              ctx.shadowBlur = 10;
              ctx.fill();
            });
          });

          // If we already marked this name earlier in the same session:
          if (markedMap[currentFake.name]) {
            // instructor asked same person again — refresh the page to "reactivate" fake profiles
            setStatus(`↺ ${currentFake.name} was already handled — refreshing.`);
            // short delay so teacher sees message, then reload
            setTimeout(() => window.location.reload(), 800);
            return;
          }

          // If overlay not visible, show it and pause auto-marking until instructor clicks mark
          if (!overlayVisible) {
            setDetectedName(currentFake.name);
            setOverlayVisible(true);
            setStatus(`🖐️ Hand detected — showing profile for ${currentFake.name}`);
            // we do not auto-mark; instructor must click mark present/absent
          }
        } else {
          // no hand detected — hide status if overlay not visible
          if (!overlayVisible) setStatus(`👀 Waiting for ${currentFake.name} to show hand...`);
        }
      } else {
        // All fake profiles done
        setStatus("✅ All fake profiles handled. Further attempts ignored until refresh.");
      }

      // continue loop
      rafId = requestAnimationFrame(detectLoop);
    }

    (async () => {
      await setupCamera();
      await tf.ready();
      detectLoop();
    })();

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafId);
      const tracks = (video.srcObject as MediaStream | null)?.getTracks();
      tracks?.forEach((t) => t.stop());
    };
  }, [isRunning, model, currentFakeIndex, overlayVisible, markedMap]);

  // Handler when instructor clicks Mark Present / Mark Absent
  const handleMark = (mark: "Present" | "Absent") => {
    const idx = currentFakeIndex;
    if (idx >= fakeProfiles.length) return;

    const fake = fakeProfiles[idx];
    // Update the main studentList entry with the matric number (if exists) or append if missing
    setStudentList((prev) => {
      const found = prev.find((s) => s.name === fake.name || s.matricNumber === fake.matricNumber);
      if (found) {
        return prev.map((s) =>
          s.name === found.name ? { ...s, status: mark } : s
        );
      } else {
        // if the fake profile doesn't actually exist in main list, append it (defensive)
        return [...prev, { ...fake, status: mark }];
      }
    });

    // mark as handled in session
    setMarkedMap((m) => ({ ...m, [fake.name]: true }));
    setStatus(`✅ Marked ${fake.name} as ${mark}`);

    // hide overlay and advance to next fake profile
    setOverlayVisible(false);
    setDetectedName("");
    setCurrentFakeIndex((i) => i + 1);
  };

  const handleStop = () => {
    setIsRunning(false);
    runningRef.current = false;
    setOverlayVisible(false);
    setStatus("✅ Attendance stopped");
  };

  const handleStart = () => {
    // reset session-specific data except keep the studentList statuses (we keep rest unchanged)
    setMarkedMap({});
    setCurrentFakeIndex(0);
    setOverlayVisible(false);
    setDetectedName("");
    setIsRunning(true);
    setStatus("▶️ Attendance started. Show hand for the first profile.");
  };

  const handleDownloadCSV = () => {
    const headers = ["Name", "Matric Number", "Status"];
    const rows = studentList.map((s) => [s.name, s.matricNumber, s.status]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].map((r) => r.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "attendance_list.csv";
    link.click();
  };

  const totalStudents = studentList.length;
  const totalPresent = studentList.filter((s) => s.status === "Present").length;
  const totalAbsent = totalStudents - totalPresent;

  const currentFake =
    currentFakeIndex < fakeProfiles.length ? fakeProfiles[currentFakeIndex] : null;

  return (
    <div className="p-6">
      <h1 className="text-3xl text-cyan-800 font-bold text-center mb-4">
        🖐️ Hand Gesture Attendance Dashboard — Two-Profile Demo Mode
      </h1>
      <p className="text-center text-gray-600 mb-2">
        Course: <strong>CSC401 — Artificial Intelligence</strong>
      </p>
      <p className="text-center text-sm text-gray-500 mb-4">
        Demo mode: only two profiles are active this session (ordered). The rest are present but ignored.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <button
          onClick={handleStart}
          disabled={isRunning}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          ▶️ Start Attendance
        </button>

        <button
          onClick={handleStop}
          disabled={!isRunning}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          ⏹ Stop Attendance
        </button>

        {!isRunning && (
          <button
            onClick={handleDownloadCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📥 Download CSV
          </button>
        )}
      </div>

      {/* VIDEO + CANVAS */}
      {isRunning && (
        <div className="relative w-full max-w-3xl mx-auto h-80 mb-6 border rounded-lg overflow-hidden">
          <video ref={videoRef} className="absolute w-full h-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="absolute w-full h-full" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-teal-300 px-4 py-1 rounded-full text-sm">
            {status}
          </div>

          {/* Overlay profile card shown when a hand is detected for the current fake profile */}
          {overlayVisible && currentFake && (
            <div className="absolute top-4 right-4 bg-white/95 border rounded-lg p-4 w-80 shadow-lg">
              <h3 className="font-bold text-lg">{currentFake.name}</h3>
              <p className="text-sm text-gray-600">{currentFake.matricNumber}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleMark("Present")}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                >
                  ✅ Mark Present
                </button>
                <button
                  onClick={() => handleMark("Absent")}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
                >
                  ❌ Mark Absent
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Tip: After marking, detection will move to the next profile. If the same profile is
                triggered again, the page will refresh to re-enable the demo two-profile flow.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 text-center mb-6">
        <div className="bg-blue-50 rounded-lg p-3">
          <h2 className="text-blue-800 font-semibold">Total Students</h2>
          <p className="text-2xl font-bold">{totalStudents}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <h2 className="text-green-800 font-semibold">Present</h2>
          <p className="text-2xl font-bold">{totalPresent}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <h2 className="text-red-800 font-semibold">Absent</h2>
          <p className="text-2xl font-bold">{totalAbsent}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-lg text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Matric Number</th>
              <th className="p-2 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {studentList.map((s) => (
              <tr key={s.matricNumber}>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">{s.matricNumber}</td>
                <td
                  className={`border p-2 font-semibold ${
                    s.status === "Present" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {s.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="mt-6 text-center text-xs text-gray-500">
        <em>Footer: This two-profile demo mode is for educational purposes only.</em>
      </div>
    </div>
  );
}