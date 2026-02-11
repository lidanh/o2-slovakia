"use client";

import { useState, useEffect, useCallback } from "react";
import { Input, Select, Space } from "antd";
import {
  defaultCountries,
  FlagImage,
  parseCountry,
} from "react-international-phone";
import "react-international-phone/style.css";
import {
  parsePhoneNumberFromString,
  AsYouType,
  type CountryCode,
} from "libphonenumber-js";

const PREFERRED_COUNTRIES = ["sk", "cz", "hu", "pl", "at", "de"];

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
}

// Country data: iso2 → dialCode lookup
const countryData = defaultCountries.map((c) => parseCountry(c));
const dialCodeMap = new Map(countryData.map((c) => [c.iso2, c.dialCode]));

// Build sorted country options: preferred first, then the rest alphabetically
const countryOptions = (() => {
  const preferred = PREFERRED_COUNTRIES
    .map((iso) => countryData.find((c) => c.iso2 === iso))
    .filter(Boolean) as typeof countryData;

  const rest = countryData
    .filter((c) => !PREFERRED_COUNTRIES.includes(c.iso2))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...preferred, ...rest].map((c) => ({
    value: c.iso2,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FlagImage iso2={c.iso2} style={{ width: 20 }} />
        <span>{c.name}</span>
        <span style={{ color: "#999" }}>+{c.dialCode}</span>
      </span>
    ),
    searchText: `${c.name} ${c.dialCode} ${c.iso2}`,
  }));
})();

/** Parse an E.164 string into country iso2 + national number */
function parseE164(e164: string): { iso2: string; national: string } {
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.country) {
    return {
      iso2: parsed.country.toLowerCase(),
      national: parsed.nationalNumber,
    };
  }
  return { iso2: "sk", national: e164.replace(/^\+/, "") };
}

/** Combine country + national number into E.164 */
function toE164(iso2: string, national: string): string {
  const cc = iso2.toUpperCase() as CountryCode;
  const dialCode = dialCodeMap.get(iso2) ?? "";
  const raw = `+${dialCode}${national}`;
  // Use libphonenumber to normalize (strips trunk prefixes, etc.)
  const parsed = parsePhoneNumberFromString(raw, cc);
  return parsed?.number ?? raw;
}

export default function PhoneInput({ value, onChange }: PhoneInputProps) {
  const [countryIso2, setCountryIso2] = useState("sk");
  const [national, setNational] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Sync internal state from external value (edit mode / form reset)
  useEffect(() => {
    if (syncing) return;
    if (!value) {
      setNational("");
      return;
    }
    const { iso2, national: nat } = parseE164(value);
    setCountryIso2(iso2);
    setNational(nat);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const emitChange = useCallback(
    (iso2: string, nat: string) => {
      if (!nat) {
        onChange?.("");
        return;
      }
      const e164 = toE164(iso2, nat);
      setSyncing(true);
      onChange?.(e164);
      // Allow the next useEffect to skip re-parsing our own change
      requestAnimationFrame(() => setSyncing(false));
    },
    [onChange]
  );

  const handleCountryChange = useCallback(
    (iso2: string) => {
      setCountryIso2(iso2);
      emitChange(iso2, national);
    },
    [national, emitChange]
  );

  const handleNationalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      setNational(digits);
      emitChange(countryIso2, digits);
    },
    [countryIso2, emitChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text").trim();
      if (pasted.startsWith("+")) {
        e.preventDefault();
        const { iso2, national: nat } = parseE164(pasted);
        setCountryIso2(iso2);
        setNational(nat);
        emitChange(iso2, nat);
      }
    },
    [emitChange]
  );

  // Generate placeholder for current country
  const placeholder = (() => {
    try {
      const cc = countryIso2.toUpperCase() as CountryCode;
      const formatter = new AsYouType(cc);
      formatter.input("+".concat(dialCodeMap.get(countryIso2) ?? "", "9".repeat(10)));
      const example = formatter.getNationalNumber() ?? "";
      return example || "123456789";
    } catch {
      return "123456789";
    }
  })();

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Select
        showSearch
        value={countryIso2}
        onChange={handleCountryChange}
        options={countryOptions}
        optionFilterProp="searchText"
        style={{ width: 100 }}
        popupMatchSelectWidth={320}
        optionRender={(option) => option.label}
        labelRender={() => (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FlagImage iso2={countryIso2} style={{ width: 20 }} />
            <span>+{dialCodeMap.get(countryIso2)}</span>
          </span>
        )}
      />
      <Input
        value={national}
        onChange={handleNationalChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        style={{ flex: 1 }}
      />
    </Space.Compact>
  );
}
