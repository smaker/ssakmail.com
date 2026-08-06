"use client";

import { Button } from "@astryxdesign/core/Button";
import {
  findImapPreset,
  IMAP_DEFAULT_PORT,
  IMAP_HOST_PRESETS,
  isValidImapHost,
  isValidImapPort,
} from "@ssakmail/mail";
import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

export const CUSTOM_IMAP_PRESET = "custom";

export type ImapFormValues = {
  preset: string;
  host: string;
  port: string;
  email: string;
  password: string;
};

export const initialImapForm = (): ImapFormValues => {
  const [first] = IMAP_HOST_PRESETS;
  return {
    preset: first?.id ?? CUSTOM_IMAP_PRESET,
    host: first?.host ?? "",
    port: String(first?.port ?? IMAP_DEFAULT_PORT),
    email: "",
    password: "",
  };
};

export const applyImapPreset = (
  values: ImapFormValues,
  preset: string,
): ImapFormValues => {
  const matched = findImapPreset(preset);
  return matched
    ? { ...values, preset, host: matched.host, port: String(matched.port) }
    : { ...values, preset };
};

/** Mirrors the server-side check so the form can explain what is wrong. */
export const imapFormError = (values: ImapFormValues) => {
  if (!isValidImapHost(values.host.trim()))
    return "IMAP 서버 주소를 확인해주세요.";
  if (!isValidImapPort(Number(values.port))) return "포트를 확인해주세요.";
  if (!values.email.trim().includes("@")) return "메일 주소를 확인해주세요.";
  if (!values.password) return "앱 비밀번호를 입력해주세요.";
  return undefined;
};

export function ImapConnectForm() {
  const [values, setValues] = useState(initialImapForm);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const preset = findImapPreset(values.preset);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = imapFormError(values);
    setError(invalid);
    if (invalid) return;
    setPending(true);
    const result = await signIn("imap", {
      redirect: false,
      callbackUrl: "/",
      host: values.host.trim(),
      port: values.port,
      email: values.email.trim(),
      password: values.password,
    });
    setPending(false);
    if (result?.error)
      setError(
        "메일 서버에 로그인하지 못했습니다. IMAP 사용 설정과 앱 비밀번호를 확인해주세요.",
      );
    else window.location.assign("/");
  };

  return (
    <form className="imap-form" onSubmit={submit}>
      <h3>다른 메일 계정 연결</h3>
      <label htmlFor="imap-preset">
        메일 서비스
        <select
          id="imap-preset"
          value={values.preset}
          onChange={(event) =>
            setValues((current) => applyImapPreset(current, event.target.value))
          }
        >
          {IMAP_HOST_PRESETS.map((option) => (
            <option value={option.id} key={option.id}>
              {option.name}
            </option>
          ))}
          <option value={CUSTOM_IMAP_PRESET}>직접 입력</option>
        </select>
      </label>
      {values.preset === CUSTOM_IMAP_PRESET && (
        <div className="imap-form-row">
          <label htmlFor="imap-host">
            IMAP 서버
            <input
              id="imap-host"
              value={values.host}
              placeholder="imap.example.com"
              autoComplete="off"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  host: event.target.value,
                }))
              }
            />
          </label>
          <label htmlFor="imap-port">
            포트
            <input
              id="imap-port"
              value={values.port}
              inputMode="numeric"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  port: event.target.value,
                }))
              }
            />
          </label>
        </div>
      )}
      <label htmlFor="imap-email">
        메일 주소
        <input
          id="imap-email"
          type="email"
          value={values.email}
          autoComplete="username"
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
        />
      </label>
      <label htmlFor="imap-password">
        앱 비밀번호
        <input
          id="imap-password"
          type="password"
          value={values.password}
          autoComplete="current-password"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
        />
      </label>
      {preset && <small>{preset.guide}</small>}
      <small>
        입력한 비밀번호는 암호화된 세션 쿠키에만 보관하며 별도로 저장하지
        않습니다.
      </small>
      {error && (
        <small className="imap-form-error" role="alert">
          {error}
        </small>
      )}
      <Button
        label={pending ? "연결 확인 중" : "메일 계정 연결"}
        variant="secondary"
        type="submit"
        isLoading={pending}
        isDisabled={pending}
      />
    </form>
  );
}
