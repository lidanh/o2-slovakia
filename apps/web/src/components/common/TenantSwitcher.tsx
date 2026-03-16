"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { SwapOutlined, CheckOutlined, LoadingOutlined } from "@ant-design/icons";

export default function TenantSwitcher() {
  const { user, switchTenant } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!user) return null;

  const tenants = user.tenants;

  // Single tenant — no switcher needed, tenant name shown in logo area
  if (tenants.length <= 1) return null;

  const currentName = user.currentTenant?.name ?? "";

  async function handleSwitch(tenantId: string) {
    if (tenantId === user?.currentTenant?.id || switching) return;
    setSwitching(true);
    try {
      await switchTenant(tenantId);
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} style={{ padding: "0 16px", marginBottom: 8, position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => !switching && setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: open
            ? "rgba(255, 255, 255, 0.12)"
            : "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 10,
          cursor: switching ? "wait" : "pointer",
          transition: "all 0.2s ease",
          outline: "none",
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "rgba(255, 255, 255, 0.10)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
        }}
      >
        {/* Tenant initial badge */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255, 255, 255, 0.9)",
            letterSpacing: "-0.3px",
            flexShrink: 0,
          }}
        >
          {currentName.charAt(0).toUpperCase()}
        </div>

        {/* Tenant name */}
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255, 255, 255, 0.85)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentName}
        </span>

        {/* Icon */}
        {switching ? (
          <LoadingOutlined style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }} spin />
        ) : (
          <SwapOutlined
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.4)",
              transition: "transform 0.2s ease",
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 16,
            right: 16,
            background: "rgba(8, 16, 72, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: 12,
            padding: 4,
            zIndex: 1000,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px",
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.35)",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
            }}
          >
            Switch workspace
          </div>
          {tenants.map((t) => {
            const isCurrent = t.id === user.currentTenant?.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSwitch(t.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: isCurrent
                    ? "rgba(255, 255, 255, 0.08)"
                    : "transparent",
                  border: "none",
                  borderRadius: 8,
                  cursor: isCurrent ? "default" : "pointer",
                  transition: "background 0.15s ease",
                  outline: "none",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Tenant initial */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: isCurrent
                      ? "linear-gradient(135deg, rgba(82, 196, 26, 0.25), rgba(82, 196, 26, 0.10))"
                      : "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
                    border: isCurrent
                      ? "1px solid rgba(82, 196, 26, 0.3)"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: isCurrent
                      ? "rgba(82, 196, 26, 0.9)"
                      : "rgba(255, 255, 255, 0.7)",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}
                >
                  {t.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent
                        ? "rgba(255, 255, 255, 0.95)"
                        : "rgba(255, 255, 255, 0.7)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.3,
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255, 255, 255, 0.35)",
                      textTransform: "capitalize",
                      lineHeight: 1.3,
                    }}
                  >
                    {t.role.replace("_", " ")}
                  </div>
                </div>

                {/* Check mark for current */}
                {isCurrent && (
                  <CheckOutlined
                    style={{
                      fontSize: 11,
                      color: "rgba(82, 196, 26, 0.8)",
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
