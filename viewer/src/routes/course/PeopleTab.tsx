import React from "react";

import { formatRoleLabel, formatPublicationStateLabel } from "../../lib/labels";
import type { ViewerCoursePeopleResponse, ViewerPerson } from "../../lib/types";

interface PeopleTabProps {
  people: ViewerCoursePeopleResponse;
}

function PersonList({ people, emptyLabel }: { people: ViewerPerson[]; emptyLabel: string }) {
  if (people.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <div className="people-grid">
      {people.map((person) => (
        <article className="panel stack-sm person-card" key={person.userId}>
          <div className="person-heading">
            <div className="stream-entry-avatar">{person.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{person.name}</strong>
              <p className="muted">{person.userId}</p>
            </div>
          </div>
          {person.email ? <p className="muted">{person.email}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function PeopleTab({ people }: PeopleTabProps) {
  return (
    <div className="stack-lg">
      <section className="panel stack-md">
        <div>
          <h2>教師 ({people.teachers.length})</h2>
          <p className="muted">このコースに登録されている教師です。</p>
        </div>
        <PersonList people={people.teachers} emptyLabel="教師データは保存されていません。" />
      </section>

      <section className="panel stack-md">
        <div>
          <h2>生徒 ({people.students.length})</h2>
          <p className="muted">このコースに登録されている生徒です。</p>
        </div>
        <PersonList people={people.students} emptyLabel="生徒データは保存されていません。" />
      </section>

      <section className="panel stack-md">
        <div>
          <h2>招待 ({people.invitations.length})</h2>
          <p className="muted">参加待ちの招待一覧です。</p>
        </div>
        {people.invitations.length > 0 ? (
          <div className="stack-sm">
            {people.invitations.map((invitation) => (
              <article className="person-line" key={invitation.invitationId}>
                <strong>{invitation.name}</strong>
                <span className="pill">{formatRoleLabel(invitation.role)}</span>
                {invitation.email ? <span className="muted">{invitation.email}</span> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">招待データは保存されていません。</p>
        )}
      </section>

      <section className="panel stack-md">
        <div>
          <h2>グループ ({people.studentGroups.length})</h2>
          <p className="muted">生徒グループとそのメンバーです。</p>
        </div>
        {people.studentGroups.length > 0 ? (
          <div className="stack-md">
            {people.studentGroups.map((group) => (
              <article className="stack-sm" key={group.studentGroupId}>
                <strong>{group.title}</strong>
                {group.members.length > 0 ? (
                  <div className="people-chip-row">
                    {group.members.map((member) => (
                      <span className="pill" key={`${group.studentGroupId}-${member.userId}`}>
                        {member.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="muted">メンバー情報は保存されていません。</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">グループデータは保存されていません。</p>
        )}
      </section>

      <section className="panel stack-md">
        <div>
          <h2>保護者 ({people.guardians.length})</h2>
          <p className="muted">このバックアップ用アカウントに紐づく保護者情報です。</p>
        </div>
        {people.guardians.length > 0 ? (
          <div className="stack-sm">
            {people.guardians.map((guardian) => (
              <article className="person-line" key={guardian.guardianId}>
                <strong>{guardian.guardianName}</strong>
                {guardian.invitedEmailAddress ? <span className="muted">{guardian.invitedEmailAddress}</span> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">保護者データは保存されていません。</p>
        )}
      </section>

      <section className="panel stack-md">
        <div>
          <h2>保護者招待 ({people.guardianInvitations.length})</h2>
          <p className="muted">保護者リンクの招待状況です。</p>
        </div>
        {people.guardianInvitations.length > 0 ? (
          <div className="stack-sm">
            {people.guardianInvitations.map((invitation) => (
              <article className="person-line" key={invitation.invitationId}>
                <strong>{invitation.invitedEmailAddress ?? invitation.invitationId}</strong>
                <span className="pill">{formatPublicationStateLabel(invitation.state)}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">保護者招待データは保存されていません。</p>
        )}
      </section>
    </div>
  );
}
