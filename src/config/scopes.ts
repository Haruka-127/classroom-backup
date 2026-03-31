export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

export type GoogleOAuthScope = (typeof GOOGLE_OAUTH_SCOPES)[number];
