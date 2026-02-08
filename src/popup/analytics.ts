import { sendMessage } from '@/pixiv/chrome';
import {
  ExtensionMessageType,
  type PopupAnalyticsEventName,
} from '@/shared/messages';

type PopupAnalyticsParams = Record<
  string,
  string | number | boolean | undefined
>;

export const trackPopupAnalytics = (
  eventName: PopupAnalyticsEventName,
  params: PopupAnalyticsParams = {},
) => {
  void sendMessage<{ ok: boolean }>({
    type: ExtensionMessageType.TrackAnalytics,
    eventName,
    params,
  }).catch(() => {
    // ignore analytics send errors in UI
  });
};
