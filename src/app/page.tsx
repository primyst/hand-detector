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

const DEMO_PROFILES = [
  { name: "Elegunde Oluwaseun", matricNumber: "LAU200002" },
  { name: "Abdulraheem Uthman", matricNumber: "LAU200001" },
];

export default function AttendanceDashboard() {
  // Full student list (unchanged) — demo reads but does not alter originals unless explicitly marking
  const [studentList, setStudentList] = useState<Student[]>(
    allStudents.map((s) => ({ ...s, status: "Absent" }))
  );

  // demo mode toggle (use only for authorized demos / tests)
  const [demoMode, setDemoMode] = useState<boolean>(true);

  // When demoMode is true, demoIndex tracks which demo profile to serve next.
  const [demoIndex, setDemoIndex] = useState<number>(0);

  // When a hand is detected, `pendingProfile` gets populated (profile details shown)
  const [pendingProfile, setPendingProfile] = useState<Student | null>(null);

  // normal UI/run state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [status, setStatus] = useState<string>("Idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef<boolean>(false);

  // Load model
  useEffect(() => {
    async function loadModel() {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const loaded = await handpose.load();
        setModel(loaded);
        setStatus("✅ Model loaded. Ready to start attendance.");
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("❌ Failed to load model.");
      }
    }
    loadModel();
  }, []);

  // Set up camera + detection loop
  useEffect(() => {
    if (!isRunning || !model) return;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    runningRef.current = true;

    async function setupCamera() {
      setStatus("📷 Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      video.srcObject = stream;
      return new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setStatus("▶️ Video started. Detecting hand...");
            resolve();
          });
        };
      });
    }

    let detectRaf = 0;
    async function detectLoop() {
      if (!runningRef.current || !model) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const predictions = await model.estimateHands(video, true);

      if (predictions.length > 0) {
        // draw landmarks for feedback
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

        // DEMO MODE behavior:
        if (demoMode && !pendingProfile) {
          // bring up the next demo profile for explicit marking
          const demo = DEMO_PROFILES[demoIndex];
          setPendingProfile({ ...demo, status: "Absent" });
          setStatus(`🖐️ Hand detected — showing demo profile: ${demo.name}`);
          // do not auto-mark — require user to press Mark Present/Absent
        } else if (!demoMode && !pendingProfile) {
          // Normal behavior: you may want to locate selected student from UI
          setStatus("🖐️ Hand detected — no pending profile selected.");
          // keep UI waiting for selection (or auto-match if you have identification)
        }
      } else {
        // no hand visible
        if (!pendingProfile) setStatus("👀 No hand detected");
      }

      if (runningRef.current) detectRaf = requestAnimationFrame(detectLoop);
    }

    (async () => {
      await setupCamera();
      await tf.ready();
      detectLoop();
    })();

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(detectRaf);
      const tracks = (video.srcObject as MediaStream | null)?.getTracks();
      tracks?.forEach((t) => t.stop());
    };
  }, [isRunning, model, demoMode, pendingProfile, demoIndex]);

  const handleStop = () => {
    setIsRunning(false);
    runningRef.current = false;
    setPendingProfile(null);
    setStatus("✅ Attendance stopped");
  };

  // Mark present or absent for the pending profile (explicit user action)
  const markPending = (mark: "Present" | "Absent") => {
    if (!pendingProfile) return;
    // In demo mode we update the studentList for UI purposes only.
    setStudentList((prev) =>
      prev.map((s) =>
        s.matricNumber === pendingProfile.matricNumber
          ? { ...s, status: mark }
          : s
      )
    );
    setStatus(`✅ Marked ${pendingProfile.name} as ${mark}`);
    // clear the pending profile and advance demoIndex so next hand shows other demo
    setPendingProfile(null);
    if (demoMode) {
      // cycle demoIndex (if you want repeat prevention, keep it strict)
      setDemoIndex((i) => (i + 1) % DEMO_PROFILES.length);
    }
  };

  // Reset demo state (no page refresh required)
  const resetDemo = () => {
    // Reset statuses for demo profiles only
    setStudentList((prev) =>
      prev.map((s) =>
        DEMO_PROFILES.some((d) => d.matricNumber === s.matricNumber)
          ? { ...s, status: "Absent" }
          : s
      )
    );
    setDemoIndex(0);
    setPendingProfile(null);
    setStatus("🔁 Demo reset");
  };

  // For cases where a physical page refresh is truly required:
  const hardRefresh = () => {
    window.location.reload();
  };

  // CSV download (unchanged)
  const handleDownloadCSV = () => {
    const headers = ["Name", "Matric Number", "Status"];
    const rows = studentList.map((s) => [s.name, s.matricNumber, s.status]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "attendance_list.csv";
    link.click();
  };

  const totalStudents = studentList.length;
  const totalPresent = studentList.filter((s) => s.status === "Present")
    .length;
  const totalAbsent = totalStudents - totalPresent;

  return (
    <div className="p-6">
      <h1 className="text-3xl text-cyan-800 font-bold text-center mb-4">
        🖐️ Hand Gesture Attendance Dashboard (Demo Mode)
      </h1>

      <p className="text-center text-gray-600 mb-6">
        Course: <strong>CSC401 — Artificial Intelligence</strong>
      </p>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <button
          onClick={() => setIsRunning(true)}
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

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => {
              setDemoMode(e.target.checked);
              // clear pending state if turning demo mode off
              setPendingProfile(null);
              setStatus(
                e.target.checked ? "🔎 Demo mode ON" : "🔎 Demo mode OFF"
              );
            }}
          />
          <span>Demo mode (authorized presentations only)</span>
        </label>

        {!isRunning && (
          <button
            onClick={handleDownloadCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📥 Download CSV
          </button>
        )}
      </div>

      {/* Camera */}
      {isRunning && (
        <div className="relative w-full max-w-3xl mx-auto h-80 mb-6 border rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="absolute w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="absolute w-full h-full" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-teal-300 px-4 py-1 rounded-full text-sm">
            {status}
          </div>
        </div>
      )}

      {/* Pending demo profile card */}
      {pendingProfile && (
        <div className="max-w-md mx-auto mb-6 border p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold">{pendingProfile.name}</h3>
          <p className="text-sm text-gray-600">{pendingProfile.matricNumber}</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => markPending("Present")}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              ✅ Mark Present
            </button>
            <button
              onClick={() => markPending("Absent")}
              className="bg-red-600 text-white px-3 py-1 rounded"
            >
              ❌ Mark Absent
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            This is a demo profile shown by demo mode. Use the explicit buttons
            to confirm — no automatic falsification occurs.
          </p>
        </div>
      )}

      {/* Demo controls */}
      {demoMode && (
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={resetDemo}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
          >
            🔁 Reset Demo
          </button>
          <button
            onClick={hardRefresh}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            ♻️ Hard Refresh Page
          </button>
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
    </div>
  );
}