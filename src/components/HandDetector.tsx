"use client";
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as handpose from "@tensorflow-models/handpose";
import { supabase } from "@/lib/supabaseClient";

interface HandDetectorProps {
  name: string;
  matricNumber: string;
  onComplete?: () => void;
}

export default function HandDetector({ name, matricNumber, onComplete }: HandDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [status, setStatus] = useState("🚀 Loading model...");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadModel() {
      await tf.setBackend("webgl");
      const loadedModel = await handpose.load();
      setModel(loadedModel);
      setStatus("✅ Model loaded. Show your hand!");
    }
    loadModel();
  }, []);

  useEffect(() => {
    if (!model) return;

    const video = videoRef.current!;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          detectLoop();
        };
      })
      .catch(console.error);

    const detectLoop = async () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      async function detect() {
        if (!model) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const predictions = await model.estimateHands(video);

        if (predictions.length > 0) {
          setStatus("🖐️ Hand detected!");

          predictions.forEach(hand => {
            hand.landmarks.forEach(([x, y]) => {
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, 2 * Math.PI);
              ctx.fillStyle = "#00ffcc";
              ctx.shadowColor = "#00ffcc";
              ctx.shadowBlur = 10;
              ctx.fill();
            });
          });

          if (!timeoutRef.current) {
            timeoutRef.current = setTimeout(async () => {
              captureAndDownload();
              await logAttendance(`${name} - ${matricNumber}`);
              setStatus("✅ Authorised! Screenshot + Attendance saved.");
              if (onComplete) onComplete();
              timeoutRef.current = null;
            }, 3000);
          }
        } else {
          setStatus("👀 No hand detected");
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
        requestAnimationFrame(detect);
      }

      detect();
    };
  }, [model, name, matricNumber, onComplete]);

  const captureAndDownload = () => {
    const canvas = canvasRef.current!;
    const link = document.createElement("a");
    link.download = "hand-detected.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  async function logAttendance(userIdentifier: string) {
    const { error } = await supabase
      .from("attendance")
      .insert([{ user_identifier: userIdentifier }]);

    if (error) {
      console.error("Error saving attendance:", error.message);
    } else {
      console.log("Attendance saved successfully");
    }
  }

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} className="absolute w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-sm px-4 py-1 rounded-full text-teal-400">
        {status}
      </div>
    </div>
  );
}