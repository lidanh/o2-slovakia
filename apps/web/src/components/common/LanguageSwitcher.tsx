"use client";

import { useState } from "react";
import { Button, Dropdown } from "antd";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES, LOCALE_FLAGS, LOCALE_LABELS, type SupportedLocale } from "@/i18n/config";
import type { MenuProps } from "antd";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleChange = async (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;
    setLoading(true);
    try {
      await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLocale }),
      });
      document.cookie = `o2-language=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
      await refresh();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const items: MenuProps["items"] = SUPPORTED_LOCALES.map((loc) => ({
    key: loc,
    label: `${LOCALE_FLAGS[loc]}  ${LOCALE_DISPLAY_NAMES[loc]}`,
    onClick: () => handleChange(loc),
    style: loc === locale ? { fontWeight: 600, color: "#0112AA" } : undefined,
  }));

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={["click"]}>
      <Button
        type="text"
        loading={loading}
        style={{ color: "#9CA3AF", height: 40, fontSize: 14, padding: "0 8px" }}
      >
        {LOCALE_FLAGS[locale as SupportedLocale]} {LOCALE_LABELS[locale as SupportedLocale]}
      </Button>
    </Dropdown>
  );
}
