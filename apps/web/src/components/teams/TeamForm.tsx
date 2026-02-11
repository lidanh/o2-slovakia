"use client";

import { useEffect } from "react";
import { Form, Input, Button } from "antd";
import type { CreateTeamPayload } from "@repo/shared";
import type { FormInstance } from "antd";

const { TextArea } = Input;

interface TeamFormProps {
  onSubmit: (values: CreateTeamPayload) => void;
  loading?: boolean;
  initialValues?: Partial<CreateTeamPayload>;
  form?: FormInstance;
  hideSubmitButton?: boolean;
  onValidityChange?: (valid: boolean) => void;
}

export default function TeamForm({ onSubmit, loading, initialValues, form: externalForm, hideSubmitButton, onValidityChange }: TeamFormProps) {
  const [internalForm] = Form.useForm();
  const form = externalForm || internalForm;
  const allValues = Form.useWatch([], form);

  useEffect(() => {
    form.validateFields({ validateOnly: true })
      .then(() => onValidityChange?.(true))
      .catch(() => onValidityChange?.(false));
  }, [form, allValues]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFinish(values: Record<string, unknown>) {
    onSubmit({
      name: values.name as string,
      description: values.description as string | undefined,
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
        <Input placeholder="Team name" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <TextArea rows={3} placeholder="Team description" />
      </Form.Item>

      {!hideSubmitButton && (
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Team
          </Button>
        </Form.Item>
      )}
    </Form>
  );
}
