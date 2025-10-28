"use client";
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as handpose from "@tensorflow-models/handpose";
import { students } from "@/data/students"; // 100 Nigerian names

interface Student {
  name: string;
  matricNumber: string;
  status: "Present" | "Absent";
}

export default function AttendanceDashboard() {
  const [studentList, setStudentList] = useState<Student[]>(
    students.map((s) => ({ ...s, status: "Absent" }))
  );
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("Idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Student | null>(null);

  const firstStudent = studentList.find(
    (s) => s.name.toUpperCase().includes("ELEGUNDE OLUWASEUN SAMUEL")
  );
  const secondStudent = studentList.find(
    (s) => s.name.toUpperCase().includes("ABDULRAHEEM UTHMAN")
  );

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
        console.error(err);
        setStatus("❌ Failed to load model.");
      }
    }
    loadModel();
  }, []);

  // Detection
  useEffect(() => {
    if (!isRunning || !model) return;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    runningRef.current = true;

    async function setupCamera() {
      setStatus("📷 Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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

    async function detectLoop() {
      if (!runningRef.current || !model) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const predictions = await model.estimateHands(video, true);
      if (predictions.length > 0) {
        if (detectionCount === 0) {
          setDetectionCount(1);
          setCurrentProfile(firstStudent || null);
          setShowProfile(true);
          setStatus("🖐️ Hand detected — showing first profile...");
        } else if (detectionCount === 1) {
          setDetectionCount(2);
          setCurrentProfile(secondStudent || null);
          setShowProfile(true);
          setStatus("🖐️ Hand detected — showing second profile...");
        } else {
          setStatus("❌ Invalid Detection! Refresh to restart.");
        }

        predictions.forEach((hand) => {
          hand.landmarks.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "#00ffcc";
            ctx.fill();
          });
        });
      }

      if (runningRef.current) requestAnimationFrame(detectLoop);
    }

    (async () => {
      await setupCamera();
      detectLoop();
    })();

    return () => {
      runningRef.current = false;
      const tracks = (video.srcObject as MediaStream | null)?.getTracks();
      tracks?.forEach((t) => t.stop());
    };
  }, [isRunning, model, detectionCount, firstStudent, secondStudent]);

  const handleMark = (status: "Present" | "Absent") => {
    if (!currentProfile) return;
    setStudentList((prev) =>
      prev.map((s) =>
        s.name === currentProfile.name ? { ...s, status } : s
      )
    );
    setShowProfile(false);
    setCurrentProfile(null);
    setStatus(`✅ ${currentProfile.name} marked ${status}`);
  };

  const handleStop = () => {
    setIsRunning(false);
    runningRef.current = false;
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
    link.download = "attendance.csv";
    link.click();
  };

  const totalStudents = studentList.length;
  const totalPresent = studentList.filter((s) => s.status === "Present").length;
  const totalAbsent = totalStudents - totalPresent;

  return (
    <div className="p-6">
      <h1 className="text-3xl text-cyan-800 font-bold text-center mb-4">
        🖐️ Hand Gesture Attendance Dashboard
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

      {/* Popup */}
      {showProfile && currentProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-sm">
            <h2 className="text-xl font-bold mb-3">Detected Student</h2>
            <p className="text-gray-800 font-semibold">
              {currentProfile.name}
            </p>
            <p className="text-gray-600 mb-4">{currentProfile.matricNumber}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleMark("Present")}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Mark Present
              </button>
              <button
                onClick={() => handleMark("Absent")}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Mark Absent
              </button>
            </div>
          </div>
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
                    s.status === "Present"
                      ? "text-green-600"
                      : "text-red-600"
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