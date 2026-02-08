const LOG_PREFIX = '[pixiv-bookmark-navigator][analytics]';
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA4_CLIENT_ID_KEY = 'ga4_client_id';
const GA4_SESSION_ID_KEY = 'ga4_session_id';

type AnalyticsParamValue = string | number | boolean | undefined;
type AnalyticsParams = Record<string, AnalyticsParamValue>;

const getGa4Config = () => {
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim();
  const apiSecret = import.meta.env.VITE_GA4_API_SECRET?.trim();
  if (!measurementId || !apiSecret) {
    return null;
  }
  return { measurementId, apiSecret };
};

const getSessionIds = async () => {
  const stored = await chrome.storage.session.get([
    GA4_CLIENT_ID_KEY,
    GA4_SESSION_ID_KEY,
  ]);

  const clientIdStored = stored[GA4_CLIENT_ID_KEY];
  const sessionIdStored = stored[GA4_SESSION_ID_KEY];
  const nowSeconds = Math.floor(Date.now() / 1000);
  const clientId =
    typeof clientIdStored === 'string' && clientIdStored.length > 0
      ? clientIdStored
      : `${nowSeconds}.${Math.floor(Math.random() * 1_000_000_000)}`;
  const sessionId =
    typeof sessionIdStored === 'number' && Number.isFinite(sessionIdStored)
      ? sessionIdStored
      : nowSeconds;

  await chrome.storage.session.set({
    [GA4_CLIENT_ID_KEY]: clientId,
    [GA4_SESSION_ID_KEY]: sessionId,
  });

  return { clientId, sessionId };
};

const normalizeParams = (params: AnalyticsParams = {}) => {
  const normalized: Record<string, string | number> = {
    engagement_time_msec: 1,
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    if (typeof value === 'boolean') {
      normalized[key] = value ? 1 : 0;
      return;
    }
    if (typeof value === 'string') {
      normalized[key] = value.slice(0, 100);
      return;
    }
    normalized[key] = value;
  });

  return normalized;
};

export const sendAnalyticsEvent = async (
  eventName: string,
  params: AnalyticsParams = {},
) => {
  const config = getGa4Config();
  if (!config) return;

  try {
    const { clientId, sessionId } = await getSessionIds();
    const url =
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(config.measurementId)}` +
      `&api_secret=${encodeURIComponent(config.apiSecret)}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        non_personalized_ads: true,
        events: [
          {
            name: eventName,
            params: {
              ...normalizeParams(params),
              session_id: sessionId,
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.warn(LOG_PREFIX, 'Failed to send GA4 event.', {
      eventName,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
