import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export async function logAttendance(
  userIdentifier: string,
  router: ReturnType<typeof useRouter>
) {
  const { error } = await supabase
    .from("attendance")
    .insert([{ user_identifier: userIdentifier }]);

  if (error) {
    console.error("Error saving attendance:", error.message);
  } else {
    console.log("Attendance saved successfully");
    router.push("/success");
  }
}