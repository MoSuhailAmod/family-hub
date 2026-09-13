---
name: family-hub-github-naming
description: Enforce Family Hub GitHub feature/task naming, numbering, ownership, labels, parent linkage, legacy-sequence rules, and approved-PR completion workflow.
version: 1.1.0
metadata:
  hermes:
    tags: [family-hub, github, issues, naming, project-management]
    category: project-management
---

# Family Hub GitHub Naming

## When to Use

Use this skill whenever creating, renaming, splitting, reorganizing, or prioritizing GitHub feature and task issues for the Family Hub repository, and when completing the PR workflow for those tasks.

Use it especially when:

- creating a new parent feature
- breaking a feature into implementation tasks
- adding another task to an existing feature
- deciding the next task number
- moving work between module backlogs
- dealing with older issues that predate the current naming convention
- reviewing, approving, merging, and cleaning up a completed task branch

## Naming Convention

### Parent feature

Use exactly:

```text
<Module> | Feature: <concise outcome>
```

Rules:

- `<Module>` is the owning Family Hub module or capability, in title case, for example `Calendar`, `Shopping`, `Notifications`, or `Deployment`.
- Use the literal separator ` | Feature: `.
- The text after `Feature:` should describe the user/business outcome, normally beginning with a lower-case verb unless a proper noun requires capitalization.
- Do not append an issue number or trailing full stop to the title.

Example:

```text
Notifications | Feature: send calendar event reminders as phone notifications
```

### Child task

Use exactly:

```text
<Module> | Task N: <concise implementation action>
```

Rules:

- `<Module>` must represent the module that **owns the work**, not merely the feature that consumes it.
- `N` is the task's sequence number **within its parent feature**, not the GitHub issue number and not a repository-wide counter.
- Use the literal separator ` | Task N: `.
- The task description should normally begin with a lower-case action verb such as `implement`, `add`, `design`, `prove`, `integrate`, `harden`, or `verify`.
- Keep the title specific enough to distinguish the task from sibling tasks.
- Do not include priority such as P0/P1/P2 in the title.

Examples:

```text
Notifications | Task 1: prove provider delivery path
Calendar | Task 5: integrate event reminder rules into calendar domain and API
```

## Procedure

### 1. Establish the owning module and parent feature

Before naming a task, identify which Family Hub module owns the data, business rules, UI, or runtime being changed.

Use that module in the task title even when another feature depends on it.

Examples of ownership:

- Calendar event fields, Calendar CRUD contracts, and Calendar forms → `Calendar`
- notification transports, device destinations, scheduling, retries, and delivery state → `Notifications`
- shopping list domain/API/UI → `Shopping`
- deployment/rebuild automation → `Deployment`

Do not create duplicate tasks in two modules for the same implementation work. Cross-link dependencies instead.

### 2. Search before assigning a task number

Before creating a task:

1. Find the parent feature.
2. Search open and closed issues that belong to that feature.
3. Identify existing explicit `Task N` titles.
4. Check older unnumbered/legacy issues that logically formed the same feature sequence.
5. Assign the next unused logical number.

Never derive `N` from the GitHub issue number.

Never reuse an existing task number under the same parent feature.

### 3. Handle legacy issue sequences safely

Older Family Hub issues may use formats such as:

```text
Calendar: manually add a new event
Shopping: verify release readiness and document module
```

When extending a legacy sequence:

- do not rename historical issues unless the user explicitly requests cleanup
- infer their logical order from the feature flow, dependencies, and creation history
- treat those existing legacy tasks as occupying their logical positions
- continue new work using the modern `Task N` convention
- record the continuation/relationship in the new issue body when it could otherwise be confusing

Do not silently renumber already-numbered tasks.

### 4. Link every child task to its parent

At or near the top of each task body, include:

```text
Parent: #<issue-number> — <exact parent feature title>
```

If the work is intentionally part of a legacy feature without a formal parent issue, clearly state the owning feature/module and the sequence relationship in the body rather than inventing a parent.

### 5. Apply labels consistently

- Child implementation issues must have the `task` label.
- Parent feature issues should use the `feature` label when that label exists in the repository and no explicit project-specific instruction overrides it.
- Preserve any additional priority/domain labels required by the feature.

### 6. Keep priority outside the title

Represent priority in the issue body, project fields, or labels.

Preferred task-body pattern:

```text
## Priority
**P0 — highest / implementation gate.**
```

Do not create titles such as:

```text
P0 Calendar | Task 2: ...
Calendar | Task 2 [HIGH]: ...
```

### 7. Avoid duplicate or superseded task definitions

Before creating a new issue, compare its intended scope with existing issues.

If the same implementation work already exists:

- update/re-home the existing task when practical, or
- explicitly supersede/close the duplicate with cross-references

Do not leave two active tasks that tell Hermes to implement the same change through different module backlogs.

## Pull Request Completion Workflow

When a Family Hub task is delivered through a pull request, use this completion sequence.

### Approval gate

Do not merge while any blocking review feedback remains unresolved.

Before approving, verify the PR against the linked task's current acceptance criteria and any later issue comments that supersede older requirements.

If the PR is satisfactory:

1. Submit the approval.
2. Merge the approved PR into its target branch, normally `main`.
3. Confirm the merge actually completed and `main` contains the merged commit/change.
4. Delete the merged feature branch from the remote repository.
5. Only after successful merge should dependent work proceed from the updated `main`.

### Branch cleanup rule

After a PR has been successfully merged, delete its remote feature branch unless there is a specific reason to retain it.

Never delete the branch before the merge succeeds.

Do not delete protected or long-lived branches such as `main`.

If GitHub blocks the merge or branch deletion, report the exact blocker instead of claiming completion.

### Review/merge responsibility

Hermes must not approve its own PRs. An authorized reviewer must approve them.

Once an authorized reviewer has approved a PR and no blocking condition remains, the normal Family Hub workflow is to **merge it immediately and then delete the merged feature branch** rather than leaving an approved PR open waiting for a separate manual merge step.

## Title Quality Rules

Prefer:

```text
Calendar | Task 6: add reminder selection to create/edit flows and event details
```

Avoid vague titles:

```text
Calendar | Task 6: reminders
Calendar | Task 6: update calendar
Calendar | Task 6: notification changes
```

A good task title says what will actually be delivered while leaving detailed acceptance criteria in the body.

## Verification Checklist

Before creating or renaming an issue, verify all of the following:

- [ ] Parent title follows `<Module> | Feature: <outcome>` when using the modern convention.
- [ ] Child title follows `<Module> | Task N: <action>`.
- [ ] Module reflects ownership of the implementation.
- [ ] `N` is unique within the parent feature.
- [ ] Existing legacy tasks were considered before choosing `N`.
- [ ] The task body links the exact parent feature where one exists.
- [ ] Child issue has the `task` label.
- [ ] Parent has the `feature` label when appropriate/available.
- [ ] Priority is not embedded in the title.
- [ ] No duplicate active task already covers the same implementation scope.

Before considering a PR workflow complete, verify:

- [ ] Blocking review comments are resolved.
- [ ] The PR is approved by an authorized reviewer.
- [ ] The PR is actually merged, not merely mergeable or assigned a prospective merge SHA.
- [ ] The target branch has advanced to include the merged work.
- [ ] The merged feature branch has been deleted from the remote repository.

## Pitfalls

- **Using GitHub issue numbers as task numbers:** task numbering is feature-local and sequential.
- **Numbering only open tasks:** closed/completed tasks still occupy their sequence number.
- **Ignoring legacy tasks:** this can restart numbering and create misleading duplicates.
- **Naming by consuming feature instead of owning module:** this blurs architectural ownership and often duplicates work.
- **Creating a second task instead of fixing an overlapping one:** search first and consolidate scope.
- **Renaming old history automatically:** preserve historical issue titles unless explicit cleanup is requested.
- **Treating approval as the end of the workflow:** after approval, merge the PR and delete the merged feature branch.
- **Confusing a prospective merge SHA with a completed merge:** verify PR state and target-branch advancement before declaring it merged.
