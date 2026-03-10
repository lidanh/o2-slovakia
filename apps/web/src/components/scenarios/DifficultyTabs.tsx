"use client";

import { Tabs, Descriptions, Slider, Typography } from "antd";
import {useTranslations} from 'next-intl';
import type { DifficultyLevel } from "@repo/shared";

const { Paragraph } = Typography;

interface DifficultyTabsProps {
  levels: DifficultyLevel[];
}

export default function DifficultyTabs({ levels }: DifficultyTabsProps) {
  const t = useTranslations('Scenarios');
  const sorted = [...levels].sort((a, b) => a.sort_order - b.sort_order);

  const items = sorted.map((level) => ({
    key: level.id,
    label: level.name,
    children: (
      <div>
        <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t('detail.difficultyPrompt')}>
            <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{level.prompt}</Paragraph>
          </Descriptions.Item>
        </Descriptions>
        <div style={{ maxWidth: 400 }}>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong>{t('detail.resistance')}: {level.resistance_level}</Typography.Text>
            <Slider value={level.resistance_level} min={1} max={10} disabled />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong>{t('detail.emotionalIntensity')}: {level.emotional_intensity}</Typography.Text>
            <Slider value={level.emotional_intensity} min={1} max={10} disabled />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong>{t('detail.cooperation')}: {level.cooperation}</Typography.Text>
            <Slider value={level.cooperation} min={1} max={10} disabled />
          </div>
        </div>
      </div>
    ),
  }));

  return <Tabs items={items} />;
}
