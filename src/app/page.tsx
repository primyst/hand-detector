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
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const runningRef = useRef(false);
  const currentIndexRef = useRef(0);

  // Load Handpose
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

  // Start detection
  useEffect(() => {
    if (!isRunning || !model) return;

    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    runningRef.current = true;

    async function setupCamera() {
      setStatus("📷 Requesting camera...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 }, // low-res for speed
            height: { ideal: 240 },
            facingMode: "user",
          },
          audio: false,
        });
        video.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            if (video.videoWidth && video.videoHeight) {
              video.play().then(resolve).catch(reject);
            } else reject("Video metadata not loaded");
          };
        });

        setStatus("▶️ Video started. Detecting hand...");
      } catch (err) {
        console.error(err);
        setStatus("❌ Failed to access camera.");
      }
    }

    let lastEstimateTime = 0;
    const FPS = 15; // throttle

    async function detectLoop() {
      if (!runningRef.current || !model) return;

      if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(detectLoop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const now = Date.now();
      if (now - lastEstimateTime > 1000 / FPS) {
        lastEstimateTime = now;

        tf.engine().startScope();
        try {
          const predictions = await model.estimateHands(video, true);
          const currentIndex = currentIndexRef.current;

          if (predictions.length > 0) {
            predictions.forEach((hand) => {
              hand.landmarks.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = currentIndex < 2 ? "#00ffcc" : "#ff5555";
                ctx.shadowColor = currentIndex < 2 ? "#00ffcc" : "#ff5555";
                ctx.shadowBlur = 10;
                ctx.fill();
              });
            });

            if (currentIndex < 2) {
              const currentStudent = studentList[currentIndex];
              setPreviewStudent(currentStudent);
              if (!timeoutRef.current) {
                setStatus(`🖐️ Detected hand. Marking ${currentStudent.name}...`);
                timeoutRef.current = setTimeout(() => {
                  setStudentList((prev) =>
                    prev.map((s, i) =>
                      i === currentIndex ? { ...s, status: "Present" } : s
                    )
                  );
                  setStatus(`✅ Marked ${currentStudent.name} as Present`);
                  currentIndexRef.current += 1;
                  setPreviewStudent(null);
                  timeoutRef.current = null;
                }, 1500);
              }
            } else {
              setPreviewStudent(null);
              setStatus("❌ Hand detected, but student not counted");
            }
          } else {
            setStatus("🖐️ Wait for hand...");
            setPreviewStudent(null);
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }
        } finally {
          tf.engine().endScope();
        }
      }

      if (runningRef.current) requestAnimationFrame(detectLoop);
    }

    (async () => {
      await setupCamera();
      await tf.ready();
      detectLoop();
    })();

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
    setStatus("✅ Attendance stopped");
    setPreviewStudent(null);
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
          {previewStudent && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500 bg-opacity-70 text-black px-4 py-1 rounded-full text-sm">
              👀 Preview: {previewStudent.name}
            </div>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-teal-300 px-4 py-1 rounded-full text-sm">
            {status}
          </div>
        </div>
      )}

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