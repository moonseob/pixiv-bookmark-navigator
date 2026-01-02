export interface PixivTitleCaptionTranslation {
  workTitle: string | null;
  workCaption: string | null;
}

export interface PixivWork {
  id: string;
  title: string;
  illustType: number;
  xRestrict: number;
  restrict: number;
  sl: number;
  url: string;
  description: string;
  tags: string[];
  userId: string;
  userName: string;
  width: number;
  height: number;
  pageCount: number;
  isBookmarkable: boolean;
  bookmarkData: unknown | null;
  alt: string;
  titleCaptionTranslation: PixivTitleCaptionTranslation;
  createDate: string;
  updateDate: string;
  isUnlisted: boolean;
  isMasked: boolean;
  aiType: number;
  visibilityScope: number;
  profileImageUrl: string;
}

export interface PixivZoneConfigItem {
  url: string;
}

export interface PixivZoneConfig {
  header?: PixivZoneConfigItem;
  footer?: PixivZoneConfigItem;
  '500x500'?: PixivZoneConfigItem;
  t_responsive_320_50?: PixivZoneConfigItem;
  t_responsive_300_250?: PixivZoneConfigItem;
  logo?: PixivZoneConfigItem;
  ad_logo?: PixivZoneConfigItem;
}

export interface PixivMetaOgp {
  description: string;
  image: string;
  title: string;
  type: string;
}

export interface PixivMetaTwitter {
  description: string;
  image: string;
  title: string;
  card: string;
}

export interface PixivMeta {
  title: string;
  description: string;
  canonical: string;
  ogp: PixivMetaOgp;
  twitter: PixivMetaTwitter;
  alternateLanguages: Record<string, string>;
  descriptionHeader: string;
}

export interface PixivExtraData {
  meta: PixivMeta;
}

export interface PixivResponseBody {
  works: PixivWork[];
  total: number;
  zoneConfig?: PixivZoneConfig;
  extraData?: PixivExtraData;
}

export interface PixivResponse {
  error: boolean;
  message: string;
  body?: PixivResponseBody;
}
