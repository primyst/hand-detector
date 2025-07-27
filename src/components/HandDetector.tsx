"use client";

import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as handpose from "@tensorflow-models/handpose";

export function HandDetector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenshotRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [status, setStatus] = useState("🚀 Loading model...");
  const [authorised, setAuthorised] = useState(false);

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
          setAuthorised(true);
          captureScreenshot(); // capture canvas

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

          // Optional: auto-hide "Authorised" after 3 seconds
          setTimeout(() => setAuthorised(false), 3000);
        } else {
          setStatus("👀 No hand detected");
        }

        requestAnimationFrame(detect);
      }

      detect();
    };
  }, [model]);

  const captureScreenshot = () => {
    const canvas = canvasRef.current;
    const screenshotCanvas = screenshotRef.current;

    if (canvas && screenshotCanvas) {
      screenshotCanvas.width = canvas.width;
      screenshotCanvas.height = canvas.height;
      const context = screenshotCanvas.getContext("2d");
      context?.drawImage(canvas, 0, 0);
      const link = document.createElement("a");
      link.download = "hand-detected.png";
      link.href = screenshotCanvas.toDataURL("image/png");
      link.click();
    }
  };

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} className="absolute w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      <canvas ref={screenshotRef} className="hidden" />

      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-sm px-4 py-1 rounded-full text-teal-400">
        {status}
      </div>

      {authorised && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-green-400 text-3xl font-bold bg-black bg-opacity-70 px-6 py-3 rounded-xl animate-pulse shadow-lg shadow-green-500/50">
          ✅ AUTHORISED
        </div>
      )}
    </div>
  );
}