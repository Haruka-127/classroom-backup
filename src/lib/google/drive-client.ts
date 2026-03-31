import { Readable } from "node:stream";
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

import type { DriveCommentRecord, DriveFileRecord } from "../../domain/classroom-types.js";
import { withRetry } from "./retry.js";

export interface DriveChangeRecord {
  fileId: string;
  removed?: boolean | null;
  time?: string | null;
}

export interface DriveService {
  getStartPageToken(): Promise<string | null>;
  listChanges(startPageToken: string): Promise<DriveChangeRecord[]>;
  getFile(fileId: string): Promise<DriveFileRecord>;
  listComments(fileId: string): Promise<DriveCommentRecord[]>;
  downloadBlob(fileId: string): Promise<Buffer>;
  exportFile(fileId: string, mimeType: string): Promise<Buffer>;
  getAbout(): Promise<{ email?: string | null; displayName?: string | null; permissionId?: string | null }>;
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function mapDriveFile(file: drive_v3.Schema$File): DriveFileRecord {
  return {
    driveFileId: file.id ?? "",
    name: file.name ?? null,
    mimeType: file.mimeType ?? null,
    md5Checksum: file.md5Checksum ?? null,
    size: file.size ?? null,
    modifiedTime: file.modifiedTime ?? null,
    version: file.version ?? null,
    trashed: file.trashed ?? null,
    webViewLink: file.webViewLink ?? null,
    exportLinks: file.exportLinks ?? null,
  };
}

function mapDriveComment(fileId: string, comment: drive_v3.Schema$Comment): DriveCommentRecord {
  return {
    driveFileId: fileId,
    commentId: comment.id ?? "",
    content: comment.content ?? null,
    authorDisplayName: comment.author?.displayName ?? null,
    createdTime: comment.createdTime ?? null,
    modifiedTime: comment.modifiedTime ?? null,
    resolved: comment.resolved ?? null,
    deleted: comment.deleted ?? null,
    quotedFileContentValue: comment.quotedFileContent?.value ?? null,
    repliesJson: comment.replies ?? [],
  };
}

export class GoogleDriveService implements DriveService {
  private readonly api: drive_v3.Drive;

  constructor(auth: OAuth2Client | null) {
    if (!auth) {
      throw new Error("Authorized Google client is required for Drive API access.");
    }

    this.api = google.drive({ version: "v3", auth });
  }

  async getAbout() {
    const response = await withRetry(() => this.api.about.get({ fields: "user(displayName,emailAddress,permissionId)" }));
    return {
      email: response.data.user?.emailAddress ?? null,
      displayName: response.data.user?.displayName ?? null,
      permissionId: response.data.user?.permissionId ?? null,
    };
  }

  async getStartPageToken(): Promise<string | null> {
    const response = await withRetry(() => this.api.changes.getStartPageToken({ supportsAllDrives: false }));
    return response.data.startPageToken ?? null;
  }

  async listChanges(startPageToken: string): Promise<DriveChangeRecord[]> {
    const records: DriveChangeRecord[] = [];
    let pageToken: string | undefined = startPageToken;

    while (pageToken) {
      const response = await withRetry(() =>
        this.api.changes.list({
          pageToken,
          pageSize: 100,
          fields: "nextPageToken,newStartPageToken,changes(fileId,removed,time)",
          supportsAllDrives: false,
        }),
      );
      records.push(
        ...(response.data.changes ?? []).flatMap((change) =>
          change.fileId
            ? [
                {
                  fileId: change.fileId,
                  removed: change.removed ?? null,
                  time: change.time ?? null,
                },
              ]
            : [],
        ),
      );
      pageToken = response.data.nextPageToken ?? undefined;

      if (!pageToken && response.data.newStartPageToken) {
        break;
      }
    }

    return records;
  }

  async getFile(fileId: string): Promise<DriveFileRecord> {
    const response = await withRetry(() =>
      this.api.files.get({
        fileId,
        fields: "id,name,mimeType,md5Checksum,size,modifiedTime,version,trashed,webViewLink,exportLinks",
      }),
    );

    return mapDriveFile(response.data);
  }

  async listComments(fileId: string): Promise<DriveCommentRecord[]> {
    const response = await withRetry(() =>
      this.api.comments.list({
        fileId,
        pageSize: 100,
        fields:
          "comments(id,content,createdTime,modifiedTime,resolved,deleted,quotedFileContent/value,author/displayName,replies(id,action,author/displayName,content,createdTime,modifiedTime,deleted))",
      }),
    );

    return (response.data.comments ?? []).map((comment) => mapDriveComment(fileId, comment)).filter((comment) => comment.commentId);
  }

  async downloadBlob(fileId: string): Promise<Buffer> {
    const response = await withRetry(() => this.api.files.get({ fileId, alt: "media" }, { responseType: "stream" }));
    return streamToBuffer(response.data as Readable);
  }

  async exportFile(fileId: string, mimeType: string): Promise<Buffer> {
    const response = await withRetry(() =>
      this.api.files.export({ fileId, mimeType }, { responseType: "stream" }),
    );
    return streamToBuffer(response.data as Readable);
  }
}
