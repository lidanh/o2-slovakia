"use client";

import { useState, useEffect } from "react";
import { App } from "antd";
import PageHeader from "@/components/common/PageHeader";
import Leaderboard from "@/components/analytics/Leaderboard";
import type { LeaderboardEntry } from "@repo/shared";
import {useTranslations} from 'next-intl';

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();
  const t = useTranslations('Analytics');
  const tCommon = useTranslations('Common');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/analytics/leaderboard");
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        setData(await res.json());
      } catch {
        message.error(tCommon('messages.failedToLoadLeaderboard'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      <PageHeader
        title={t('leaderboard.title')}
        subtitle={t('leaderboard.subtitle')}
        backHref="/analytics"
      />
      <Leaderboard data={data} loading={loading} />
    </>
  );
}
