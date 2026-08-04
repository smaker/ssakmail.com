"use client";

import {
  QueryClient,
  QueryClientProvider,
  queryOptions,
} from "@tanstack/react-query";
import axios from "axios";
import { type ReactNode, useState } from "react";

export type AppStatus = {
  app: string;
  status: "ready";
};

export const fetchStatus = async () => {
  const { data } = await axios.get<AppStatus>("/api/status");
  return data;
};

export const statusQueryOptions = () =>
  queryOptions({
    queryKey: ["status"],
    queryFn: fetchStatus,
    staleTime: 60_000,
  });

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
