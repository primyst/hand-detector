"use client";

import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { students } from "@/data/students"; // your 100 Nigerian names

interface Student {
  name: string;
  matricNumber: string;
  status: "Present" | "Absent";
}

export default function AttendanceDashboard() {
  const [studentList, setStudentList] = useState<Student[]>(
    students.map((s) => ({ ...s, status: "Absent" }))
  );
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [detector, setDetector] =
    useState<handPoseDetection.HandDetector | null>(null);
  const [status, setStatus] = useState<string>("Idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionRef = useRef<boolean>(false);

  // Load MediaPipe model
  useEffect(() => {
    async function loadModel() {
      await tf.setBackend("webgl");
      await tf.ready();

      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
        runtime: "tfjs",
        modelType: "lite", // options: 'lite', 'full'
      };

      const newDetector = await handPoseDetection.createDetector(
        model,
        detectorConfig
      );
      setDetector(newDetector);
      setStatus("✅ Model loaded — ready to start");
    }

    loadModel();
  }, []);

  // Start the attendance detection
  useEffect(() => {
    if (!isRunning || !detector) return;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let stop = false;

    async function setupCamera() {
      setStatus("📷 Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      video.srcObject = stream;

      return new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setStatus("▶️ Video playing, detecting hand...");
            resolve();
          });
        };
      });
    }

    async function detectHands() {
      if (!detector || stop) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const hands = await detector.estimateHands(video, { flipHorizontal: true });

        if (hands.length > 0 && selectedStudent) {
          setStatus(`🖐️ Hand detected for ${selectedStudent}`);

          hands.forEach((hand) => {
            hand.keypoints?.forEach((pt) => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = "#00FFCC";
              ctx.fill();
            });
          });

          // Mark selected student present
          setStudentList((prev) =>
            prev.map((s) =>
              s.name === selectedStudent ? { ...s, status: "Present" } : s
            )
          );
        } else if (selectedStudent) {
          setStatus(`👀 No hand detected for ${selectedStudent}`);
        }
      } catch (err) {
        console.error("Detection error:", err);
        setStatus("⚠️ Error during detection");
      }

      if (detectionRef.current) requestAnimationFrame(detectHands);
    }

    (async () => {
      await setupCamera();
      detectionRef.current = true;
      detectHands();
    })();

    return () => {
      stop = true;
      detectionRef.current = false;
      const tracks = (video.srcObject as MediaStream | null)?.getTracks();
      tracks?.forEach((t) => t.stop());
    };
  }, [isRunning, detector, selectedStudent]);

  // Stop attendance
  const handleStop = () => {
    setIsRunning(false);
    setSelectedStudent("");
    detectionRef.current = false;
    setStatus("✅ Attendance stopped");
  };

  // Download attendance as CSV
  const handleDownloadCSV = () => {
    const headers = ["Name", "Matric Number", "Status"];
    const rows = studentList.map((s) => [s.name, s.matricNumber, s.status]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "attendance_list.csv";
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
        <select
          disabled={!isRunning}
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="border rounded p-2"
        >
          <option value="">-- Select Student --</option>
          {studentList.map((s) => (
            <option key={s.matricNumber} value={s.name}>
              {s.name} ({s.matricNumber})
            </option>
          ))}
        </select>
        {!isRunning && (
          <button
            onClick={handleDownloadCSV}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📥 Download CSV
          </button>
        )}
      </div>

      {/* Camera view */}
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