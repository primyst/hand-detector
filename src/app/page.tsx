import { HandDetector } from "@/src/components/HandDetector";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-4xl font-bold mb-4">
        🖐️ Hand Detector
      </h1>
      <p className="text-gray-400 mb-8">
        Detect hands in real time using TensorFlow.js
      </p>

      <div className="relative border border-gray-700 rounded-xl overflow-hidden shadow-2xl max-w-full w-[640px] aspect-video">
        <HandDetector />
      </div>
    </main>
  );
}