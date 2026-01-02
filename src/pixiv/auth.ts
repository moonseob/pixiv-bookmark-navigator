const parseNextData = (html: string) => {
  const match = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
};

const findTokenFromNextData = (node: unknown): string | null => {
  if (!node || typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;
  const api = record.api as Record<string, unknown> | undefined;
  if (api && typeof api.token === 'string' && api.token.length > 8) {
    return api.token;
  }
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findTokenFromNextData(item);
        if (found) return found;
      }
      continue;
    }
    if (value && typeof value === 'object') {
      const found = findTokenFromNextData(value);
      if (found) return found;
    }
  }
  return null;
};

const getTokenFromServerSerializedState = (nextData: unknown): string | null => {
  if (!nextData || typeof nextData !== 'object') return null;
  const props = (nextData as Record<string, unknown>).props;
  if (!props || typeof props !== 'object') return null;
  const pageProps = (props as Record<string, unknown>).pageProps;
  if (!pageProps || typeof pageProps !== 'object') return null;
  const state =
    (pageProps as Record<string, unknown>).serverSerializedPreloadedState;
  if (typeof state !== 'string') return null;
  try {
    const parsed = JSON.parse(state) as unknown;
    return findTokenFromNextData(parsed);
  } catch {
    return null;
  }
};

const getServerSerializedState = (nextData: unknown): unknown | null => {
  if (!nextData || typeof nextData !== 'object') return null;
  const props = (nextData as Record<string, unknown>).props;
  if (!props || typeof props !== 'object') return null;
  const pageProps = (props as Record<string, unknown>).pageProps;
  if (!pageProps || typeof pageProps !== 'object') return null;
  const state =
    (pageProps as Record<string, unknown>).serverSerializedPreloadedState;
  if (typeof state !== 'string') return null;
  try {
    return JSON.parse(state) as unknown;
  } catch {
    return null;
  }
};

const findBookmarkIdFromState = (
  node: unknown,
  workId: string,
): string | null => {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBookmarkIdFromState(item, workId);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  if (record.id === workId || String(record.id ?? '') === workId) {
    const bookmarkData = record.bookmarkData as Record<string, unknown> | null;
    const bookmarkId = bookmarkData?.id;
    if (typeof bookmarkId === 'string' || typeof bookmarkId === 'number') {
      return String(bookmarkId);
    }
  }
  for (const value of Object.values(record)) {
    const found = findBookmarkIdFromState(value, workId);
    if (found) return found;
  }
  return null;
};

export const fetchArtworkPageData = async (workId: string) => {
  const url = `https://www.pixiv.net/artworks/${workId}`;
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to load Pixiv page.');
  }
  const html = await response.text();
  const nextData = parseNextData(html);
  const tokenFromState = nextData ? getTokenFromServerSerializedState(nextData) : null;
  const tokenFromNext = nextData ? findTokenFromNextData(nextData) : null;
  const state = nextData ? getServerSerializedState(nextData) : null;
  const bookmarkId = state ? findBookmarkIdFromState(state, workId) : null;
  const metaMatch = html.match(/name="csrf-token" content="([^"]+)"/);
  const tokenFromMeta = metaMatch?.[1] ?? null;
  const csrfToken = tokenFromState ?? tokenFromNext ?? tokenFromMeta;
  if (bookmarkId) {
    return {
      csrfToken,
      bookmarkId,
    };
  }
  const ajaxResponse = await fetch(
    `https://www.pixiv.net/ajax/illust/${workId}`,
    { credentials: 'include' },
  );
  if (!ajaxResponse.ok) {
    throw new Error('Failed to load artwork details.');
  }
  const ajaxData = (await ajaxResponse.json()) as {
    body?: { bookmarkData?: { id?: string | number | null } | null };
  };
  const ajaxBookmarkId = ajaxData.body?.bookmarkData?.id;
  return {
    csrfToken,
    bookmarkId:
      ajaxBookmarkId == null ? null : String(ajaxBookmarkId),
  };
};

export const getCsrfTokenFromHtml = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to load Pixiv page.');
  }
  const html = await response.text();
  const nextData = parseNextData(html);
  if (nextData) {
    const tokenFromState = getTokenFromServerSerializedState(nextData);
    if (tokenFromState) {
      return tokenFromState;
    }
    const tokenFromNext = findTokenFromNextData(nextData);
    if (tokenFromNext) {
      return tokenFromNext;
    }
  }
  const metaMatch = html.match(/name="csrf-token" content="([^"]+)"/);
  if (metaMatch?.[1]) {
    return metaMatch[1];
  }
  throw new Error('Failed to read Pixiv token.');
};

type FetchWithCsrfOptions = {
  url: string;
  csrfFromUrl: string;
  method?: 'POST' | 'PUT' | 'DELETE';
  contentType?: string;
  body?: string;
};

export const fetchWithCsrfToken = async ({
  url,
  csrfFromUrl,
  method = 'POST',
  contentType = 'application/json; charset=utf-8',
  body,
}: FetchWithCsrfOptions) => {
  const token = await getCsrfTokenFromHtml(csrfFromUrl);
  return fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': contentType,
      'X-CSRF-TOKEN': token,
    },
    body,
  });
};
