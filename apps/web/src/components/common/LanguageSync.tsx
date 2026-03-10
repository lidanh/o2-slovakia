"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LanguageSync() {
  const { user } = useAuth();
  const router = useRouter();
  const synced = useRef(false);

  useEffect(() => {
    if (!user?.language || synced.current) return;
    synced.current = true;

    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("o2-language="))
      ?.split("=")[1];

    if (cookie !== user.language) {
      document.cookie = `o2-language=${user.language};path=/;max-age=31536000;SameSite=Lax`;
      router.refresh();
    }
  }, [user?.language, router]);

  return null;
}
