const SUPERTEAM_BASE_URL = process.env.SUPERTEAM_BASE_URL || 'https://superteam.fun';
const SUPERTEAM_API_KEY = process.env.SUPERTEAM_API_KEY || '';

interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  auth?: boolean;
  params?: Record<string, string | number>;
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function superteamFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, auth = true, params } = options;

  let url = `${SUPERTEAM_BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth && SUPERTEAM_API_KEY) {
    headers['Authorization'] = `Bearer ${SUPERTEAM_API_KEY}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T;

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}
