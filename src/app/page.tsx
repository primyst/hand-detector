"use client";
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as handpose from "@tensorflow-models/handpose";
import { students } from "@/data/students";

interface Student {
  name: string;
  matricNumber: string;
  status: "Present" | "Absent";
}

export default function AttendanceDashboard() {
  const [studentList, setStudentList] = useState<Student[]>(
    students.map((s) => ({ ...s, status: "Absent" }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [status, setStatus] = useState("Idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const currentIndexRef = useRef(0);
  const handHoldStartRef = useRef<number | null>(null);

  // Load handpose model
  useEffect(() => {
    async function loadModel() {
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        const loaded = await handpose.load();
        setModel(loaded);
        setStatus("✅ Model loaded. Ready to start attendance.");
      } catch (err) {
        console.error(err);
        setStatus("❌ Failed to load model.");
      }
    }
    loadModel();
  }, []);

  // Start detection loop
  useEffect(() => {
    if (!isRunning || !model) return;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    runningRef.current = true;

    async function startCamera() {
      try {
        setStatus("📷 Requesting camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play();
        setStatus("▶️ Video started. Waiting for hand...");

        const loop = async () => {
          if (!runningRef.current || !model) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const predictions = await model.estimateHands(video, true);

          const idx = currentIndexRef.current;

          if (idx >= 2) {
            setStatus("⚠️ Only first two students can be marked present");
          } else {
            const student = studentList[idx];

            if (predictions.length > 0) {
              // Draw hand landmarks
              predictions.forEach((hand) =>
                hand.landmarks.forEach(([x, y]) => {
                  ctx.beginPath();
                  ctx.arc(x, y, 5, 0, Math.PI * 2);
                  ctx.fillStyle = "#00ffcc";
                  ctx.fill();
                })
              );

              const now = performance.now();
              if (!handHoldStartRef.current) handHoldStartRef.current = now;

              const elapsed = now - handHoldStartRef.current;

              if (elapsed >= 1500) {
                // mark present
                setStudentList((prev) =>
                  prev.map((s, i) =>
                    i === idx ? { ...s, status: "Present" } : s
                  )
                );
                setStatus(`✅ Marked ${student.name} as Present`);
                currentIndexRef.current += 1;
                handHoldStartRef.current = null;
              } else {
                setStatus(
                  `🖐️ Hold hand for ${student.name} (${(1500 - elapsed) / 1000
                    ).toFixed(1)}s)`
                );
              }
            } else {
              handHoldStartRef.current = null;
              setStatus(`👀 Waiting for hand for ${student.name}`);
            }
          }

          requestAnimationFrame(loop);
        };

        loop();
      } catch (err) {
        console.error(err);
        setStatus("❌ Failed to access camera");
      }
    }

    startCamera();

    return () => {
      runningRef.current = false;
      const tracks = (video.srcObject as MediaStream | null)?.getTracks();
      tracks?.forEach((t) => t.stop());
    };
  }, [isRunning, model, studentList]);

  const handleStop = () => {
    setIsRunning(false);
    runningRef.current = false;
    currentIndexRef.current = 0;
    handHoldStartRef.current = null;
    setStatus("✅ Attendance stopped");
  };

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

  const totalPresent = studentList.filter((s) => s.status === "Present").length;
  const totalAbsent = studentList.length - totalPresent;

  return (
    <div className="p-6">
      <h1 className="text-3xl text-cyan-800 font-bold text-center mb-4">
        🖐️ Hand Gesture Attendance Dashboard
      </h1>
      <p className="text-center text-gray-600 mb-6">
        Course: <strong>CSC401 — Artificial Intelligence</strong>
      </p>

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
        {!isRunning && (
          <button
            onClick={handleDownloadCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📥 Download CSV
          </button>
        )}
      </div>

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

      <div className="grid grid-cols-3 gap-4 text-center mb-6">
        <div className="bg-blue-50 rounded-lg p-3">
          <h2 className="text-blue-800 font-semibold">Total Students</h2>
          <p className="text-2xl font-bold">{studentList.length}</p>
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

      <p className="text-center mt-4 text-gray-500 text-sm">
        ⚠️ Note: Only the first two students on the list are marked. Hand must be held steady for 1.5 seconds. For educational purposes only.
      </p>
    </div>
  );
}