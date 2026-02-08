export enum ExtensionMessageType {
  RandomRequest = 'PIXIV_RANDOM_REQUEST',
  ResolveUser = 'PIXIV_RESOLVE_USER_ID',
  TrackAnalytics = 'PIXIV_TRACK_ANALYTICS',
}

export type PopupAnalyticsEventName =
  | 'popup_opened'
  | 'bookmark_visibility_changed'
  | 'tag_filter_cleared';
