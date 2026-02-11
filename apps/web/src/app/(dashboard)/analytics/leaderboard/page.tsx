"use client";

import { useState, useEffect } from "react";
import { App } from "antd";
import PageHeader from "@/components/common/PageHeader";
import Leaderboard from "@/components/analytics/Leaderboard";
import type { LeaderboardEntry } from "@repo/shared";

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/leaderboard");
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        setData(await res.json());
      } catch {
        message.error("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      <PageHeader
        title="Leaderboard"
        subtitle="Top performing training participants"
        backHref="/analytics"
      />
      <Leaderboard data={data} loading={loading} />
    </>
  );
}
