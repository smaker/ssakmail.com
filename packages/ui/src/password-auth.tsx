"use client";

import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PROVIDER_ID,
  validatePasswordCredentials,
} from "@ssakmail/auth/password";
import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

type AuthMode = "login" | "signup";

export function PasswordAuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    const validated = validatePasswordCredentials({
      email,
      password,
      name: mode === "signup" ? name : undefined,
    });
    if ("error" in validated) {
      setError(validated.error);
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: validated.email,
            password: validated.password,
            name: validated.name,
          }),
        });
        const body: unknown = await response.json().catch(() => undefined);
        if (!response.ok) {
          const message =
            body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "string"
              ? body.error
              : "가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.";
          setError(message);
          return;
        }
      }

      const result = await signIn(PASSWORD_PROVIDER_ID, {
        email: validated.email,
        password: validated.password,
        callbackUrl: "/",
        redirect: false,
      });
      if (!result?.ok) {
        setError("메일 주소 또는 비밀번호를 확인해주세요.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="password-auth" aria-labelledby="password-auth-title">
      <h3 id="password-auth-title">싹메일 계정</h3>
      <p>메일 주소로 간단히 시작하고, 언제든 연결한 메일을 정리하세요.</p>
      <nav className="password-auth-mode" aria-label="계정 이용 방식">
        <button
          type="button"
          aria-pressed={mode === "login"}
          data-active={mode === "login"}
          onClick={() => {
            setMode("login");
            setError(undefined);
          }}
        >
          로그인
        </button>
        <button
          type="button"
          aria-pressed={mode === "signup"}
          data-active={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError(undefined);
          }}
        >
          회원가입
        </button>
      </nav>
      <form className="password-auth-form" onSubmit={submit} noValidate>
        <VStack gap={3}>
          {mode === "signup" && (
            <TextInput
              label="이름"
              value={name}
              onChange={setName}
              htmlName="name"
              isOptional
              width="100%"
              placeholder="어떻게 불러드릴까요?"
            />
          )}
          <TextInput
            type="email"
            label="이메일"
            value={email}
            onChange={setEmail}
            htmlName="email"
            isRequired
            width="100%"
            placeholder="name@example.com"
          />
          <TextInput
            type="password"
            label="비밀번호"
            value={password}
            onChange={setPassword}
            htmlName="password"
            isRequired
            width="100%"
            description={`${PASSWORD_MIN_LENGTH}자 이상 입력해주세요.`}
          />
          {error && (
            <p className="password-auth-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            label={mode === "login" ? "이메일로 로그인" : "계정 만들기"}
            variant="primary"
            width="100%"
            isLoading={isSubmitting}
          />
        </VStack>
      </form>
    </section>
  );
}
