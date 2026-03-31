import { describe, expect, it, vi } from "vitest";

import { GoogleDriveService } from "../../src/lib/google/drive-client.js";

describe("GoogleDriveService", () => {
  it("paginates through Drive comments", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          comments: [{ id: "comment-1", content: "First" }],
          nextPageToken: "page-2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          comments: [{ id: "comment-2", content: "Second" }],
        },
      });

    const service = new GoogleDriveService({} as never);
    (service as any).api = {
      comments: {
        list,
      },
    };

    const comments = await service.listComments("drive-1");

    expect(comments.map((comment) => comment.commentId)).toEqual(["comment-1", "comment-2"]);
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[0]?.[0]).toMatchObject({ fileId: "drive-1", pageSize: 100, pageToken: undefined });
    expect(list.mock.calls[1]?.[0]).toMatchObject({ fileId: "drive-1", pageSize: 100, pageToken: "page-2" });
  });
});
