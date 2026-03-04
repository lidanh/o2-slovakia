"use client";

import { useState, useEffect } from "react";
import { Card, Form, Input, Button, Typography, App, Spin, Divider, Row, Col, Tag } from "antd";
import { SaveOutlined, LockOutlined } from "@ant-design/icons";
import PageHeader from "@/components/common/PageHeader";
import PhoneInput from "@/components/common/PhoneInput";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

const { Text } = Typography;

export default function MyProfilePage() {
  const { message } = App.useApp();
  const { user, refresh } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    profileForm.setFieldsValue({ name: user.name, phone: user.phone ?? "" });

    // Fetch team name if user has a team
    if (user.teamId) {
      fetch(`/api/teams/${user.teamId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.name) setTeamName(data.name);
        })
        .catch(() => {});
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = async (values: { name: string; phone: string }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, phone: values.phone || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update profile");
      }
      message.success("Profile updated");
      await refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (values: { password: string; confirm: string }) => {
    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      message.success("Password changed successfully");
      passwordForm.resetFields();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return <Spin size="large" style={{ display: "block", margin: "100px auto" }} />;

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    team_manager: "Team Manager",
    user: "Trainee",
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Manage your account settings" />

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title="Profile Information" variant="borderless">
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleSaveProfile}
            >
              <Form.Item
                label="Name"
                name="name"
                rules={[{ required: true, message: "Name is required" }]}
              >
                <Input />
              </Form.Item>

              <Form.Item label="Phone" name="phone">
                <PhoneInput />
              </Form.Item>

              <Form.Item label="Email">
                <Input value={user.email} disabled />
              </Form.Item>

              <Form.Item label="Team">
                <Input value={teamName ?? "No team"} disabled />
              </Form.Item>

              <Form.Item label="Role">
                <div>
                  <Tag color="blue">{roleLabels[user.role] ?? user.role}</Tag>
                </div>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Change Password" variant="borderless">
            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
              Set a new password for your account.
            </Text>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
            >
              <Form.Item
                label="New Password"
                name="password"
                rules={[
                  { required: true, message: "Password is required" },
                  { min: 8, message: "Password must be at least 8 characters" },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>

              <Form.Item
                label="Confirm Password"
                name="confirm"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Please confirm your password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<LockOutlined />}
                  loading={changingPassword}
                >
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  );
}
