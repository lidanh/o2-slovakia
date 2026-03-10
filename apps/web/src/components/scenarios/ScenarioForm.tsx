"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Form, Input, Select, Slider, InputNumber, Result, Badge, Tabs } from "antd";
import { PlusOutlined, SettingOutlined, ApiOutlined, CloseOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useRouter } from "next/navigation";
import {useTranslations} from 'next-intl';
import type { CreateScenarioPayload, CreateDifficultyLevelPayload, WonderfulAgent } from "@repo/shared";
import type { FormInstance } from "antd";
import MarkdownEditor from "@/components/common/MarkdownEditor";

const { TextArea } = Input;

type AgentStatus = "loading" | "ready" | "not_configured" | "no_agents" | "error";

interface ScenarioFormProps {
  onSubmit: (values: CreateScenarioPayload) => void;
  loading?: boolean;
  initialValues?: Partial<CreateScenarioPayload>;
  form?: FormInstance;
  hideSubmitButton?: boolean;
  onFormReady?: (ready: boolean) => void;
  onValidityChange?: (valid: boolean) => void;
}

const SCENARIO_TAB_KEY = "scenario-details";

const DEFAULT_VALUES: Partial<CreateScenarioPayload> = {
  type: "frontline",
  difficulty_levels: [
    { name: "Easy", prompt: "", resistance_level: 3, emotional_intensity: 3, cooperation: 7, sort_order: 1 },
  ],
};

export default function ScenarioForm({ onSubmit, loading, initialValues, form: externalForm, hideSubmitButton, onFormReady, onValidityChange }: ScenarioFormProps) {
  const t = useTranslations('Scenarios');
  const tCommon = useTranslations('Common');
  const [internalForm] = Form.useForm();
  const form = externalForm || internalForm;
  const router = useRouter();
  const [agents, setAgents] = useState<WonderfulAgent[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("loading");
  const [activeTab, setActiveTab] = useState(SCENARIO_TAB_KEY);
  const pendingAddRef = useRef(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isEditing = !!initialValues?.name;

  // Watch only the difficulty_levels field for tab label updates,
  // NOT all fields (which would cause re-renders on every keystroke)
  const difficultyLevels = Form.useWatch("difficulty_levels", form) as { name?: string }[] | undefined;

  // Debounced validation to avoid overwhelming the form on every keystroke
  const runValidation = useCallback(() => {
    if (agentStatus === "loading") return;
    if (!isEditing && (agentStatus === "not_configured" || agentStatus === "no_agents")) return;
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }
    validationTimerRef.current = setTimeout(() => {
      form.validateFields({ validateOnly: true })
        .then(() => onValidityChange?.(true))
        .catch(() => onValidityChange?.(false));
    }, 100);
  }, [agentStatus, isEditing, form, onValidityChange]);

  // Populate form data once on mount. We call setFieldsValue explicitly
  // because the form instance (from useForm in the parent) may have stale
  // initialValues from a previous <Form> mount/unmount cycle.
  useEffect(() => {
    form.setFieldsValue({ ...DEFAULT_VALUES, ...initialValues });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Run validation once agents have loaded (validation needs agent_id rules)
  useEffect(() => {
    if (agentStatus !== "loading") {
      runValidation();
    }
  }, [agentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up validation timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetch("/api/wonderful/agents")
      .then(async (res) => {
        if (res.status === 422) {
          const data = await res.json();
          if (data.error === "not_configured") {
            setAgentStatus("not_configured");
            if (!isEditing) onFormReady?.(false);
            return;
          }
        }
        if (!res.ok) throw new Error("Failed to fetch agents");
        const data: WonderfulAgent[] = await res.json();
        if (data.length === 0) {
          setAgentStatus("no_agents");
          if (!isEditing) onFormReady?.(false);
        } else {
          setAgents(data);
          setAgentStatus("ready");
          onFormReady?.(true);
        }
      })
      .catch(() => {
        setAgentStatus("error");
        onFormReady?.(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFinish(values: Record<string, unknown>) {
    const payload: CreateScenarioPayload = {
      name: values.name as string,
      description: values.description as string,
      prompt: values.prompt as string,
      type: values.type as "frontline" | "leadership",
      agent_id: (values.agent_id as string) || null,
      difficulty_levels: (values.difficulty_levels as CreateDifficultyLevelPayload[]) || [],
    };
    onSubmit(payload);
  }

  // For non-editing empty states, show a Result page without any <Form>.
  // We avoid mounting a hidden <Form> because two <Form> components sharing
  // the same form instance causes the second mount to reset the store.
  if (!isEditing && agentStatus === "not_configured") {
    return (
      <Result
        icon={<SettingOutlined style={{ color: "#0112AA" }} />}
        title={t('connectWonderful.title')}
        subTitle={t('connectWonderful.subtitle')}
        extra={
          <Button type="primary" onClick={() => router.push("/settings")}>
            {tCommon('buttons.goToSettings')}
          </Button>
        }
      />
    );
  }

  if (!isEditing && agentStatus === "no_agents") {
    return (
      <Result
        icon={<ApiOutlined style={{ color: "#0112AA" }} />}
        title={t('noAgents.title')}
        subTitle={t('noAgents.subtitle')}
      />
    );
  }

  const safeDifficultyLevels = (difficultyLevels ?? []) as { name?: string }[];

  const fieldErrors = form.getFieldsError();
  const scenarioFieldNames = ["name", "description", "prompt", "type", "agent_id"];
  const scenarioHasErrors = fieldErrors.some(
    (f) => f.errors.length > 0 && scenarioFieldNames.includes(f.name[0] as string)
  );
  const difficultyErrors = (idx: number) =>
    fieldErrors.some(
      (f) =>
        f.errors.length > 0 &&
        f.name[0] === "difficulty_levels" &&
        f.name[1] === idx
    );

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      onValuesChange={runValidation}
      initialValues={{ ...DEFAULT_VALUES, ...initialValues }}
    >
          <Form.List name="difficulty_levels">
            {(fields, { add, remove }) => {
              if (pendingAddRef.current && fields.length > 0) {
                const lastField = fields[fields.length - 1];
                const newTabKey = `difficulty-${lastField.key}`;
                pendingAddRef.current = false;
                queueMicrotask(() => setActiveTab(newTabKey));
              }

              const tabs = [
                { key: SCENARIO_TAB_KEY, label: t('form.scenarioDetails'), closable: false, hasErrors: scenarioHasErrors },
                ...fields.map(({ key, name }) => {
                  const levelName = safeDifficultyLevels[name]?.name;
                  return {
                    key: `difficulty-${key}`,
                    label: levelName?.trim() || "",
                    closable: fields.length > 1,
                    hasErrors: difficultyErrors(name),
                    fieldName: name,
                  };
                }),
              ];

              return (
                <>
                  {/* AntD Tabs navigation */}
                  <Tabs
                    type="line"
                    size="small"
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabBarStyle={{ marginBottom: 20, borderBottom: "1px solid #F0F0F0" }}
                    tabBarExtraContent={{
                      right: (
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            pendingAddRef.current = true;
                            add({
                              name: "",
                              prompt: "",
                              resistance_level: 5,
                              emotional_intensity: 5,
                              cooperation: 5,
                              sort_order: fields.length + 1,
                            });
                          }}
                          style={{ color: "#6b7280", fontSize: 13 }}
                        >
                          {t('form.addLevel')}
                        </Button>
                      ),
                    }}
                    items={tabs.map((tab) => ({
                      key: tab.key,
                      label: (
                        <Badge dot={tab.hasErrors} offset={[2, -1]} status="error">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {tab.key === SCENARIO_TAB_KEY
                              ? t('form.scenarioDetails')
                              : tab.label || <span style={{ fontStyle: "italic", opacity: 0.6 }}>{t('form.newLevel')}</span>}
                            {tab.closable && (
                              <CloseOutlined
                                style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 4 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const fieldIndex = fields.findIndex((f) => `difficulty-${f.key}` === tab.key);
                                  if (fieldIndex === -1) return;
                                  if (activeTab === tab.key) {
                                    if (fieldIndex > 0) {
                                      setActiveTab(`difficulty-${fields[fieldIndex - 1].key}`);
                                    } else if (fields.length > 1) {
                                      setActiveTab(`difficulty-${fields[fieldIndex + 1].key}`);
                                    } else {
                                      setActiveTab(SCENARIO_TAB_KEY);
                                    }
                                  }
                                  remove(fields[fieldIndex].name);
                                }}
                              />
                            )}
                          </span>
                        </Badge>
                      ),
                      closable: false,
                    }))}
                  />

                  {/* Difficulty level panels */}
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ display: activeTab === `difficulty-${key}` ? "block" : "none", animation: activeTab === `difficulty-${key}` ? "fadeIn 0.25s ease-out" : "none" }}>
                      <Form.Item
                        {...restField}
                        name={[name, "name"]}
                        label={t('form.name')}
                        rules={[{ required: true, message: t('form.nameRequired') }]}
                      >
                        <Input placeholder={t('form.difficultyNamePlaceholder')} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "prompt"]}
                        label={t('form.difficultyPrompt')}
                        rules={[{ required: true, message: t('form.promptRequired') }]}
                      >
                        <MarkdownEditor height={200} placeholder={t('form.difficultyPromptPlaceholder')} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "resistance_level"]}
                        label={t('form.resistanceLevel')}
                      >
                        <Slider min={1} max={10} marks={{ 1: "1", 5: "5", 10: "10" }} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "emotional_intensity"]}
                        label={t('form.emotionalIntensity')}
                      >
                        <Slider min={1} max={10} marks={{ 1: "1", 5: "5", 10: "10" }} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, "cooperation"]}
                        label={t('form.cooperation')}
                      >
                        <Slider min={1} max={10} marks={{ 1: "1", 5: "5", 10: "10" }} />
                      </Form.Item>

                      <Form.Item {...restField} name={[name, "sort_order"]} hidden>
                        <InputNumber />
                      </Form.Item>
                    </div>
                  ))}
                </>
              );
            }}
          </Form.List>

          {/* Scenario Details panel — rendered OUTSIDE Form.List so field
              names register at the top level (e.g. "name") instead of being
              prefixed with "difficulty_levels". Hidden difficulty panels above
              use display:none and take no space, so this flows right below
              the Tabs bar visually. */}
          <div style={{ display: activeTab === SCENARIO_TAB_KEY ? "block" : "none", animation: activeTab === SCENARIO_TAB_KEY ? "fadeIn 0.25s ease-out" : "none" }}>
            <Form.Item name="name" label={t('form.name')} rules={[{ required: true, message: t('form.nameRequired') }]}>
              <Input placeholder={t('form.namePlaceholder')} />
            </Form.Item>

            <Form.Item name="description" label={t('form.description')}>
              <TextArea rows={3} placeholder={t('form.descriptionPlaceholder')} />
            </Form.Item>

            <Form.Item name="prompt" label={t('form.basePrompt')} rules={[{ required: true, message: t('form.promptRequired') }]}>
              <MarkdownEditor height={300} placeholder={t('form.basePromptPlaceholder')} />
            </Form.Item>

            <Form.Item name="type" label={t('form.type')} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "frontline", label: tCommon('scenarioTypes.frontline') },
                  { value: "leadership", label: tCommon('scenarioTypes.leadership') },
                ]}
              />
            </Form.Item>

            <Form.Item name="agent_id" label={t('form.aiAgent')} rules={agentStatus === "ready" ? [{ required: true, message: t('form.selectAgent') }] : []}>
              <Select
                allowClear
                showSearch
                placeholder={agentStatus === "loading" ? t('form.loadingAgents') : agentStatus === "error" ? t('form.failedToLoadAgents') : t('form.useDefaultAgent')}
                loading={agentStatus === "loading"}
                disabled={agentStatus === "loading" || agentStatus === "error"}
                filterOption={(input, option) =>
                  (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={agents.map((agent) => ({
                  value: agent.id,
                  label: agent.display_name || agent.name,
                }))}
              />
            </Form.Item>
          </div>

          {!hideSubmitButton && (
            <Form.Item style={{ marginTop: 24 }}>
              <Button type="primary" htmlType="submit" loading={loading}>
                {tCommon('buttons.saveScenario')}
              </Button>
            </Form.Item>
          )}
    </Form>
  );
}
