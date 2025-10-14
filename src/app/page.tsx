"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import HandDetector from "@/components/HandDetector";

// --- Type Definitions ---
interface Student {
  id: number;
  name: string;
  matricNumber: string;
  courseCode: string;
}

interface Attendance {
  id: number;
  matricNumber: string;
  courseCode: string;
  date: string;
  timeIn: string;
}

// --- Dashboard Component ---
export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("CSC401");
  const [today, setToday] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [showDetector, setShowDetector] = useState<boolean>(false);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data: studentsData, error: studentErr } = await supabase
        .from("students")
        .select("id, name, matricNumber, courseCode")
        .eq("courseCode", selectedCourse);

      const { data: attendanceData, error: attendanceErr } = await supabase
        .from("attendance")
        .select("id, matricNumber, courseCode, date, timeIn")
        .eq("courseCode", selectedCourse)
        .eq("date", today);

      if (!studentErr && studentsData) setStudents(studentsData);
      if (!attendanceErr && attendanceData) setAttendance(attendanceData);
    };

    fetchData();
  }, [selectedCourse, today]);

  // Determine attendance status
  const getStatus = (matricNumber: string): "Present" | "Absent" => {
    return attendance.some((a) => a.matricNumber === matricNumber)
      ? "Present"
      : "Absent";
  };

  const totalStudents = students.length;
  const totalPresent = attendance.length;
  const totalAbsent = totalStudents - totalPresent;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-cyan-800 mb-6 text-center">
        Hand Gesture-Based Student Attendance Dashboard
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <select
          className="border rounded p-2"
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
        >
          <option value="CSC401">CSC401</option>
          <option value="CSC402">CSC402</option>
          <option value="CSC403">CSC403</option>
        </select>

        <input
          type="date"
          className="border rounded p-2"
          value={today}
          onChange={(e) => setToday(e.target.value)}
        />

        <button
          onClick={() => setShowDetector(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
        >
          Take Attendance (Show Hand)
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
        <div className="bg-blue-50 rounded-lg p-4">
          <h2 className="font-semibold text-blue-700">Total Students</h2>
          <p className="text-2xl font-bold">{totalStudents}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h2 className="font-semibold text-green-700">Present</h2>
          <p className="text-2xl font-bold">{totalPresent}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <h2 className="font-semibold text-red-700">Absent</h2>
          <p className="text-2xl font-bold">{totalAbsent}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border">Name</th>
              <th className="p-3 border">Matric Number</th>
              <th className="p-3 border">Course</th>
              <th className="p-3 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="text-center">
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">{s.matricNumber}</td>
                <td className="border p-2">{s.courseCode}</td>
                <td
                  className={`border p-2 font-semibold ${
                    getStatus(s.matricNumber) === "Present"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {getStatus(s.matricNumber)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hand Detector Modal */}
      {showDetector && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="relative w-full h-full max-w-4xl mx-auto">
            <button
              onClick={() => setShowDetector(false)}
              className="absolute top-4 right-4 z-50 bg-white px-3 py-1 rounded shadow text-black"
            >
              ✖ Close
            </button>
            <HandDetector
              name="Live Attendance"
              matricNumber="auto"
              onComplete={() => {
                setShowDetector(false);
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}