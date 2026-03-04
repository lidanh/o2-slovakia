import { redirect } from "next/navigation";

// Middleware handles role-based redirect for authenticated users.
// This is a fallback if middleware doesn't catch it.
export default function Home() {
  redirect("/dashboard");
}
