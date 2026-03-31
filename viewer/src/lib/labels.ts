export function formatWorkTypeLabel(workType: string | null | undefined): string {
  switch (workType) {
    case "ASSIGNMENT":
      return "課題";
    case "SHORT_ANSWER_QUESTION":
      return "記述式の質問";
    case "MULTIPLE_CHOICE_QUESTION":
      return "選択式の質問";
    default:
      return workType ?? "課題";
  }
}

export function formatAttachmentTypeLabel(attachmentType: string): string {
  switch (attachmentType) {
    case "drive_file":
      return "ドライブファイル";
    case "link":
      return "リンク";
    case "youtube":
      return "YouTube";
    case "form":
      return "フォーム";
    default:
      return attachmentType.replace(/_/g, " ");
  }
}

export function formatSubmissionStateLabel(state: string | null): string {
  switch (state) {
    case "CREATED":
      return "未提出";
    case "TURNED_IN":
      return "提出済み";
    case "RETURNED":
      return "返却済み";
    case "RECLAIMED_BY_STUDENT":
      return "返却後に取り下げ";
    default:
      return state ?? "不明";
  }
}
