"use client";

import { useState, useEffect } from "react";
import { Card, Form, Input, Button, Typography, App, Spin, Divider, Row, Col, Tag } from "antd";
import { SaveOutlined, LockOutlined } from "@ant-design/icons";
import {useTranslations} from 'next-intl';
import PageHeader from "@/components/common/PageHeader";
import PhoneInput from "@/components/common/PhoneInput";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

const { Text } = Typography;

export default function MyProfilePage() {
  const t = useTranslations('Profile');
  const tCommon = useTranslations('Common');
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
      message.success(tCommon('messages.profileUpdated'));
      await refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('messages.failedToUpdateProfile'));
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
      message.success(tCommon('messages.passwordChanged'));
      passwordForm.resetFields();
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('messages.failedToChangePassword'));
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
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title={t('profileInformation')} variant="borderless">
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleSaveProfile}
            >
              <Form.Item
                label={t('name')}
                name="name"
                rules={[{ required: true, message: t('nameRequired') }]}
              >
                <Input />
              </Form.Item>

              <Form.Item label={t('phone')} name="phone">
                <PhoneInput />
              </Form.Item>

              <Form.Item label={t('email')}>
                <Input value={user.email} disabled />
              </Form.Item>

              <Form.Item label={t('team')}>
                <Input value={teamName ?? t('noTeam')} disabled />
              </Form.Item>

              <Form.Item label={t('role')}>
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
                  {t('saveChanges')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={t('changePassword')} variant="borderless">
            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
              {t('changePasswordDescription')}
            </Text>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleChangePassword}
            >
              <Form.Item
                label={t('newPassword')}
                name="password"
                rules={[
                  { required: true, message: t('passwordRequired') },
                  { min: 8, message: t('passwordMinLength') },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>

              <Form.Item
                label={t('confirmPassword')}
                name="confirm"
                dependencies={["password"]}
                rules={[
                  { required: true, message: t('confirmPasswordRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('passwordsDoNotMatch')));
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
                  {t('changePassword')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  );
}
