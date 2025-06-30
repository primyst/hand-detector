"use client";
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as handpose from "@tensorflow-models/handpose";

export function HandDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [status, setStatus] = useState("🚀 Loading model...");

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
    navigator.mediaDevices
      .getUserMedia({ video: true })
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
          predictions.forEach((hand) => {
            hand.landmarks.forEach(([x, y]) => {
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, 2 * Math.PI);
              ctx.fillStyle = "#00ffcc";
              ctx.shadowColor = "#00ffcc";
              ctx.shadowBlur = 10;
              ctx.fill();
            });
          });
        } else {
          setStatus("👀 No hand detected");
        }

        requestAnimationFrame(detect);
      }

      detect();
    };
  }, [model]);

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
