"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  App,
  Flex,
  Form,
} from "antd";
import {
  SaveOutlined,
  ReloadOutlined,
  LinkOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import PageHeader from "@/components/common/PageHeader";

const { Text } = Typography;

interface FormValues {
  tenant_url: string;
  api_key: string;
}

export default function SettingsPage() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [existingConfig, setExistingConfig] = useState<Record<string, unknown>>(
    {}
  );
  const { message } = App.useApp();

  const tenantUrl = Form.useWatch("tenant_url", form);
  const allValues = Form.useWatch([], form);

  useEffect(() => {
    form.validateFields({ validateOnly: true })
      .then(() => setFormValid(true))
      .catch(() => setFormValid(false));
  }, [form, allValues]);

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent-config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();
      const config = data.config ?? {};
      setExistingConfig(config);

      const wonderful = (config.wonderful ?? {}) as Record<string, string>;

      form.setFieldsValue({
        tenant_url: wonderful.tenant_url ?? "",
        api_key: wonderful.api_key ?? "",
      });
    } catch {
      message.error("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSaving(true);
    try {
      const wonderful = (existingConfig.wonderful ?? {}) as Record<
        string,
        unknown
      >;
      const agentId = (wonderful.agent_id as string) ?? "";

      const merged = {
        ...existingConfig,
        wonderful: {
          ...wonderful,
          tenant_url: values.tenant_url,
          api_key: values.api_key,
          agent_id: agentId,
        },
      };

      const res = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: merged }),
      });
      if (!res.ok) throw new Error("Failed to save config");

      const data = await res.json();
      setExistingConfig(data.config ?? merged);
      message.success("Configuration saved");
    } catch {
      message.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  let baseUrl = "";
  try {
    if (tenantUrl) baseUrl = new URL(tenantUrl).origin;
  } catch { /* invalid URL */ }

  const derivedTwiml = baseUrl
    ? `${baseUrl}/telephony/twilio/outbound?agent_id={agent_id}`
    : "";
  const derivedWs = baseUrl
    ? `${baseUrl.replace(/^http/, "ws")}/agent/{agent_id}/ws`
    : "";

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure the AI agent" />

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Flex
          justify="space-between"
          align="center"
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #F0F0F0",
          }}
        >
          <div>
            <Text strong style={{ fontSize: 15 }}>
              Agent Configuration
            </Text>
            <br />
            <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
              Wonderful agent ID and API key
            </Text>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchConfig}
              loading={loading}
              className="icon-spin-hover"
            >
              Reload
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!formValid}
            >
              Save Changes
            </Button>
          </Space>
        </Flex>

        <div style={{ padding: "24px" }}>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            autoComplete="off"
          >
            {/* Wonderful AI Section */}
            <div style={{ marginBottom: 32 }}>
              <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
                <ApiOutlined style={{ fontSize: 16, color: "#0112AA" }} />
                <Text strong style={{ fontSize: 14 }}>
                  Wonderful AI
                </Text>
              </Flex>

              <Form.Item
                label="Tenant URL"
                name="tenant_url"
                rules={[
                  { required: true, message: "Tenant URL is required" },
                  { type: "url", message: "Must be a valid URL" },
                ]}
              >
                <Input placeholder="https://app.wonderful.ai" />
              </Form.Item>

              <Form.Item
                label="API Key"
                name="api_key"
                rules={[
                  { required: true, message: "API Key is required" },
                ]}
              >
                <Input.Password placeholder="wnd_..." />
              </Form.Item>

              {tenantUrl && (
                <div
                  style={{
                    background: "#F5F5FF",
                    border: "1px solid #E8E8F5",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <Flex align="center" gap={6} style={{ marginBottom: 8 }}>
                    <LinkOutlined
                      style={{ fontSize: 12, color: "#0112AA" }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#0112AA",
                      }}
                    >
                      Derived URLs
                    </Text>
                  </Flex>
                  <div style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, color: "#6B7280" }}>
                      TwiML URL
                    </Text>
                    <br />
                    <Text
                      code
                      style={{ fontSize: 12, wordBreak: "break-all" }}
                    >
                      {derivedTwiml}
                    </Text>
                  </div>
                  <div>
                    <Text style={{ fontSize: 11, color: "#6B7280" }}>
                      WebSocket URL
                    </Text>
                    <br />
                    <Text
                      code
                      style={{ fontSize: 12, wordBreak: "break-all" }}
                    >
                      {derivedWs}
                    </Text>
                  </div>
                </div>
              )}
            </div>

          </Form>
        </div>
      </Card>
    </>
  );
}
