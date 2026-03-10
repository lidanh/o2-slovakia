"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Spin, App } from "antd";
import {useTranslations} from 'next-intl';
import PageHeader from "@/components/common/PageHeader";
import SessionDetail from "@/components/training/SessionDetail";
import type { SessionWithDetails } from "@repo/shared";

export default function TrainingSessionDetailPage() {
  const t = useTranslations('Training');
  const tCommon = useTranslations('Common');
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/training/sessions/${sessionId}`);
        if (!res.ok) throw new Error("Failed to fetch session");
        setSession(await res.json());
      } catch {
        message.error(tCommon('messages.failedToLoadSession'));
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) return <div>{t('sessionNotFound')}</div>;

  return (
    <>
      <PageHeader
        title={t('sessionTitle', { scenarioName: session.scenario?.name ?? "Unknown" })}
        subtitle={t('sessionSubtitle', { userName: session.user?.name ?? "Unknown", date: new Date(session.created_at).toLocaleString("sk-SK") })}
        backHref="/training"
      />
      <SessionDetail session={session} onSessionUpdate={setSession} />
    </>
  );
}
