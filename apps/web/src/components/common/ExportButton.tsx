"use client";

import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useState } from "react";

interface ExportButtonProps {
  url: string;
  filename?: string;
  label?: string;
}

export default function ExportButton({
  url,
  filename = "export.xlsx",
  label = "Export",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button icon={<DownloadOutlined />} loading={loading} onClick={handleExport}>
      {label}
    </Button>
  );
}
