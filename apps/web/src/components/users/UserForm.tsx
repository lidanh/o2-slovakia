"use client";

import { Form, Input, Select, Button, App } from "antd";
import { useState, useEffect } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { CreateUserPayload, Team } from "@repo/shared";
import type { FormInstance } from "antd";
import PhoneInput from "@/components/common/PhoneInput";

interface UserFormProps {
  onSubmit: (values: CreateUserPayload) => void;
  loading?: boolean;
  initialValues?: Partial<CreateUserPayload>;
  form?: FormInstance;
  hideSubmitButton?: boolean;
  onValidityChange?: (valid: boolean) => void;
}

export default function UserForm({ onSubmit, loading, initialValues, form: externalForm, hideSubmitButton, onValidityChange }: UserFormProps) {
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
      .catch(() => message.error("Failed to load teams"));
  }, []);

  function handleFinish(values: Record<string, unknown>) {
    onSubmit({
      name: values.name as string,
      email: values.email as string,
      phone: values.phone as string,
      team_id: values.team_id as string | undefined,
    });
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={initialValues}
    >
      <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
        <Input placeholder="Full name" />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: "Email is required" },
          { type: "email", message: "Invalid email" },
        ]}
      >
        <Input placeholder="email@example.com" />
      </Form.Item>

      <Form.Item
        name="phone"
        label="Phone"
        rules={[
          { required: true, message: "Phone is required" },
          {
            validator: (_, val) =>
              val && isValidPhoneNumber(val)
                ? Promise.resolve()
                : Promise.reject(new Error("Enter a valid phone number")),
          },
        ]}
      >
        <PhoneInput />
      </Form.Item>

      <Form.Item name="team_id" label="Team">
        <Select
          allowClear
          placeholder="Select team"
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Form.Item>

      {!hideSubmitButton && (
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save User
          </Button>
        </Form.Item>
      )}
    </Form>
  );
}
