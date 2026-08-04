# Ssakmail Monorepo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create and deploy a GitHub-hosted Next.js monorepo for ssakmail.com with separate responsive web and mobile applications.

**Architecture:** Use a plain pnpm workspace with two independently deployable Next.js apps and two shared packages. Keep the deployment boundary explicit without adding Turborepo or another orchestration dependency.

**Tech Stack:** Next.js, React, TypeScript, Axios, TanStack Query, PostCSS, Biome, pnpm, Vercel

---

### Task 1: Create the workspace

**Files:** Create root workspace configuration, shared packages, and both Next.js apps.

1. Add package manifests, TypeScript configuration, Biome configuration, and PostCSS configuration.
2. Add a shared query client/provider and a shared status-card component.
3. Add `/api/status` and a minimal landing page to each app.
4. Install dependencies and generate the lockfile.

### Task 2: Lock behavior and quality

**Files:** Create focused tests for shared status rendering and workspace contracts.

1. Add the smallest runnable tests covering the shared data-access and UI behavior.
2. Run Biome, TypeScript checks, tests, and production builds.
3. Review the complete diff and fix every finding.

### Task 3: Publish and deploy

1. Commit only repository files and create `smaker/ssakmail.com` on GitHub.
2. Push `main` and prove local/remote SHA equality.
3. Create separate Vercel production projects for `apps/web` and `apps/mobile`.
4. Verify both production URLs with HTTP and browser-responsive smoke checks.
