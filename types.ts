export type Lang = 'en' | 'si';

export type PageTab =
  | 'home'
  | 'families'
  | 'family-detail'
  | 'features'
  | 'chat'
  | 'moments'
  | 'admin';

export type FeatureSubTab = 'birthdays' | 'trips' | 'events';

export interface LocalProfile {
  clientId: string;
  name: string;
  avatarUrl: string;
}

export interface SiteSettings {
  siteTitleEn?: string;
  siteTitleSi?: string;
  heroKickerEn?: string;
  heroKickerSi?: string;
  heroPhotoUrl: string;
  welcomeEn: string;
  welcomeSi: string;
  aboutTitleEn?: string;
  aboutTitleSi?: string;
  aboutStoryEn?: string;
  aboutStorySi?: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  sortOrder: number;
  nameEn: string;
  nameSi: string;
  descriptionEn: string;
  descriptionSi: string;
  coverPhotoUrl: string;
  memberCount?: number;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  name: string;
  relationship: string;
  birthday: string;
  photoUrl: string;
  description: string;
  familyNameEn?: string;
  familyNameSi?: string;
}

export interface MediaAsset {
  url: string;
  type: 'image' | 'video';
  name?: string;
}

export interface BirthdayWish {
  id: string;
  authorName: string;
  authorAvatar: string;
  authorAvatars?: string[];
  message: string;
  createdAt: string;
}

export interface BirthdayEntry {
  id: string;
  targetKey: string;
  source: 'birthday' | 'member';
  memberName: string;
  birthDate: string;
  familyId?: string | null;
  familyNameEn?: string;
  familyNameSi?: string;
  photoUrl?: string;
  notes?: string;
  wishes: BirthdayWish[];
}

export interface TripEntry {
  id: string;
  title: string;
  destination: string;
  tripDate: string;
  familyId: string;
  familyNameEn?: string;
  familyNameSi?: string;
  description: string;
  media: MediaAsset[];
  createdByName: string;
  likeCount?: number;
  likedByMe?: boolean;
}

export interface EventEntry {
  id: string;
  title: string;
  category: string;
  eventDate: string;
  location: string;
  familyId?: string | null;
  description: string;
  media: MediaAsset[];
  status: 'approved' | 'suggested';
  createdByName: string;
  likeCount?: number;
  likedByMe?: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  location: string;
  caption: string;
  momentDate: string;
  kind: 'gallery' | 'timeline' | 'moment';
  familyId?: string | null;
  familyNameEn?: string;
  familyNameSi?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  uploadedByName: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface FamilyHistoryData {
  trips: TripEntry[];
  pictures: GalleryItem[];
  events: EventEntry[];
  birthdays: BirthdayEntry[];
}

export interface ChatRoom {
  roomId: string;
  nameEn: string;
  nameSi: string;
  coverPhotoUrl?: string;
  unreadCount: number;
  lastMessage?: {
    senderName: string;
    text: string;
    mediaType?: string | null;
  };
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderAvatars?: string[];
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'important';
  familyId?: string | null;
  authorName: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  titleEn: string;
  titleSi: string;
  bodyEn: string;
  bodySi: string;
  linkTab: string;
  isRead: boolean;
  createdAt: string;
}
