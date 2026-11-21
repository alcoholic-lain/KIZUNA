import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function csrf() {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("Serveur injoignable", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || `Erreur ${res.status}`, res.status, data?.fields);
  return data as T;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2000, refetchOnWindowFocus: false } },
});

export function useApi<T = any>(path: string | null, opts: { refetch?: number; enabled?: boolean } = {}) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => api<T>(path as string),
    enabled: !!path && opts.enabled !== false,
    refetchInterval: opts.refetch,
    placeholderData: (prev) => prev,
  });
}

/** POST/DELETE helper: toasts the result and refreshes every query. */
export function useAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = "POST", body }: { path: string; method?: string; body?: unknown; success?: string }) =>
      api(path, { method, body }),
    onSuccess: (data: any, vars) => {
      const msg = vars.success ?? data?.message;
      if (msg) toast.success(msg);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
