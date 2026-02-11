"use client";

import { Flex, Typography, Button, Space } from "antd";
import { ArrowLeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  createHref?: string;
  createLabel?: string;
  extra?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  backHref,
  createHref,
  createLabel,
  extra,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <Flex
      justify="space-between"
      align="center"
      className="animate-slide-in"
      style={{ marginBottom: 28 }}
    >
      <Flex align="center" gap={12}>
        {backHref && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(backHref)}
            style={{
              color: "#9CA3AF",
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid #F0F0F0",
              transition: "all 0.2s ease",
            }}
          />
        )}
        <div>
          <Title
            level={2}
            style={{
              margin: 0,
              fontWeight: 500,
              letterSpacing: "-0.3px",
              color: "#1a1a2e",
            }}
          >
            {title}
          </Title>
          {subtitle && (
            <Text
              style={{
                fontSize: 14,
                marginTop: 2,
                display: "block",
                color: "#9CA3AF",
              }}
            >
              {subtitle}
            </Text>
          )}
        </div>
      </Flex>
      <Space size={12}>
        {extra}
        {createHref && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push(createHref)}
          >
            {createLabel ?? "Create"}
          </Button>
        )}
      </Space>
    </Flex>
  );
}
