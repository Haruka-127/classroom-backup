import { describe, expect, it } from "vitest";

import type { ClassroomService } from "../../src/lib/google/classroom-client.js";

describe("ClassroomService interface coverage", () => {
  it("documents the granular endpoint surface expected by sync", async () => {
    const methodNames: Array<keyof ClassroomService> = [
      "listCourses",
      "getCourse",
      "listCourseAliases",
      "getGradingPeriodSettings",
      "listTopics",
      "getTopic",
      "listAnnouncements",
      "getAnnouncement",
      "listCourseWork",
      "getCourseWork",
      "listRubrics",
      "getRubric",
      "listCourseWorkMaterials",
      "getCourseWorkMaterial",
      "listStudentSubmissions",
      "getStudentSubmission",
      "listStudents",
      "getStudent",
      "listTeachers",
      "getTeacher",
      "getUserProfile",
      "listInvitations",
      "getInvitation",
      "listStudentGroups",
      "listStudentGroupMembers",
      "listGuardians",
      "getGuardian",
      "listGuardianInvitations",
      "getGuardianInvitation",
    ];

    expect(methodNames).toHaveLength(29);
  });
});
