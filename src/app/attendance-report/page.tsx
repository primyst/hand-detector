"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AttendanceRecord {
  id: number;
  user_identifier: string;
  timestamp: string;
}

export default function AttendanceReport() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_identifier, timestamp")
        .order("timestamp", { ascending: false });

      if (error) {
        setError(error.message);
      } else if (data) {
        setRecords(data);
      }
      setLoading(false);
    }
    fetchAttendance();
  }, []);

  if (loading) return <p className="p-4 text-center">Loading attendance...</p>;
  if (error) return <p className="p-4 text-center text-red-600">Error: {error}</p>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Attendance Report</h1>
      {records.length === 0 ? (
        <p>No attendance records found.</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2 text-left">User Identifier</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {records.map(({ id, user_identifier, timestamp }) => (
              <tr key={id} className="hover:bg-gray-100">
                <td className="border border-gray-300 px-4 py-2">{user_identifier}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {new Date(timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}