"use client";

import { Form, Input, Select, Button, App } from "antd";
import { useState, useEffect } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useTranslations } from "next-intl";
import type { InviteUserPayload, Team, UserRole } from "@repo/shared";
import type { FormInstance } from "antd";
import PhoneInput from "@/components/common/PhoneInput";

interface UserFormProps {
  onSubmit: (values: InviteUserPayload) => void;
  loading?: boolean;
  initialValues?: Partial<InviteUserPayload>;
  form?: FormInstance;
  hideSubmitButton?: boolean;
  onValidityChange?: (valid: boolean) => void;
  currentUserRole?: UserRole;
}

export default function UserForm({ onSubmit, loading, initialValues, form: externalForm, hideSubmitButton, onValidityChange, currentUserRole }: UserFormProps) {
  const t = useTranslations('Users');
  const tCommon = useTranslations('Common');
  const [internalForm] = Form.useForm();
  const form = externalForm || internalForm;
  const { message } = App.useApp();
  const [teams, setTeams] = useState<Team[]>([]);
  const allValues = Form.useWatch([], form);

  useEffect(() => {
    form.validateFields({ validateOnly: true })
      .then(() => onValidityChange?.(true))
      .catch(() => onValidityChange?.(false));
  }, [form, allValues]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load teams");
        return res.json();
      })
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => message.error(tCommon('messages.failedToLoadTeams')));
  }, []);

  function handleFinish(values: Record<string, unknown>) {
    onSubmit({
      name: values.name as string,
      email: values.email as string,
      phone: values.phone as string | undefined,
      role: (values.role as InviteUserPayload["role"]) || "user",
      team_id: values.team_id as string | undefined,
    });
  }

  const isManager = currentUserRole === "team_manager";

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ role: isManager ? "user" : undefined, ...initialValues }}
    >
      <Form.Item name="name" label={t('form.name')} rules={[{ required: true, message: t('form.nameRequired') }]}>
        <Input placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="email"
        label={t('form.email')}
        rules={[
          { required: true, message: t('form.emailRequired') },
          { type: "email", message: t('form.invalidEmail') },
        ]}
      >
        <Input placeholder={t('form.emailPlaceholder')} />
      </Form.Item>

      <Form.Item
        name="phone"
        label={t('form.phone')}
        rules={[
          {
            validator: (_, val) =>
              !val || isValidPhoneNumber(val)
                ? Promise.resolve()
                : Promise.reject(new Error(t('form.invalidPhone'))),
          },
        ]}
      >
        <PhoneInput />
      </Form.Item>

      <Form.Item name="role" label={t('form.role')} rules={[{ required: true, message: t('form.roleRequired') }]}>
        <Select
          placeholder={t('form.selectRole')}
          disabled={isManager}
          options={[
            { value: "admin", label: t('form.roleOptions.admin') },
            { value: "team_manager", label: t('form.roleOptions.teamManager') },
            { value: "user", label: t('form.roleOptions.user') },
          ]}
        />
      </Form.Item>

      <Form.Item name="team_id" label={t('form.team')}>
        <Select
          allowClear
          placeholder={t('form.selectTeam')}
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
        />
      </Form.Item>

      {!hideSubmitButton && (
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            {tCommon('buttons.saveUser')}
          </Button>
        </Form.Item>
      )}
    </Form>
  );
}
