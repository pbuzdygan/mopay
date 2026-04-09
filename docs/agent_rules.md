# Agent Rules

Practical rules for AI agents working on software projects with low token usage, low noise, and predictable output quality.

This guide was shaped by work patterns visible in Mopay dev, especially:
- a few very large central files (`backend/server.js`, `frontend/src/components/TableView.tsx`)
- a mix of frontend, backend, docs, and release work
- repeated need to inspect only a narrow slice of the codebase, not the whole repository

The rules below are universal and should be applied in any project unless the user explicitly asks for a different workflow.

## 1. Main objective

The agent should minimize token consumption without reducing engineering quality.

That means:
- read less, but read the right files
- avoid re-reading the same content
- work in small, verifiable steps
- keep answers short and operational
- prefer targeted diffs over full-file rewrites

## 2. Default operating mode

The agent should assume this workflow:

1. Understand the task in one sentence.
2. Map only the relevant part of the repository.
3. Read the minimum code needed to act safely.
4. Propose or apply the smallest useful change.
5. Verify only the affected area.
6. Report outcome briefly, without replaying the whole investigation.

If the task is simple, skip extended analysis and execute directly.

## 3. Rules for repository exploration

### 3.1 Read structure before content

Always start with file discovery, not with opening large files.

Preferred order:
1. list top-level folders
2. search file names
3. search symbols or text patterns
4. open only matched files or matched line ranges

Preferred tools and style:
- use `rg --files` to discover files
- use `rg` to find functions, components, routes, env vars, and symbols
- use `sed -n`, `head`, `tail`, or line-limited reads instead of opening full files

### 3.2 Never load large files by default

If a file is large, do not read it from top to bottom unless the task truly requires it.

For files like large API servers, large React views, stores, stylesheets, and import/export logic:
- find the exact symbol first
- open a narrow line range around that symbol
- expand only if the local context is insufficient

### 3.3 Avoid duplicate reads

Do not reopen the same file sections repeatedly.

After reading a file, the agent should keep a short working summary such as:
- responsibility of the file
- symbols already inspected
- risk areas
- next likely edit point

The summary is cheaper than loading the same file again.

### 3.4 Ignore irrelevant weight

Do not spend tokens on:
- generated files
- lockfiles
- images and binary assets
- unrelated docs
- unrelated frontend styles
- unrelated release history

Read them only if the task directly depends on them.

## 4. Rules for understanding changes

### 4.1 Trace from entry point to implementation

Follow the shortest path from request to code:
- UI issue: component -> local state -> API call -> backend route
- backend issue: route -> helper -> db/migration/security logic
- release issue: workflow -> version source -> UI/status display

Do not read parallel subsystems unless there is evidence they are involved.

### 4.2 Prefer evidence over assumptions

Before changing code, verify:
- where the feature starts
- which file owns the behavior
- whether there is already a helper or utility for it
- whether the same pattern exists elsewhere

### 4.3 Search for existing conventions

Before introducing new code, search for:
- naming conventions
- modal patterns
- API wrapper usage
- store update style
- validation style
- error handling style

Reusing existing patterns reduces both token cost and implementation risk.

## 5. Rules for editing

### 5.1 Make the smallest safe edit

Prefer:
- local patch
- extracted helper
- small conditional
- one new function near current ownership

Avoid:
- broad rewrites
- style churn
- mass renaming
- moving code without strong reason
- rewriting a file just to "clean it up"

### 5.2 One problem per patch

Each edit batch should solve one main issue.

If a task reveals unrelated cleanup opportunities, note them but do not include them unless they are required for correctness.

### 5.3 Preserve surrounding structure

Do not reformat or reorder unrelated code.

Large files cost more tokens when diff noise increases. Small, precise diffs are easier to review and cheaper to continue working with later.

### 5.4 Extract only when it reduces future cost

Refactor only if it clearly lowers future context size or repeated reasoning.

Good extraction candidates:
- repeated validation logic
- repeated response formatting
- repeated UI action groups
- repeated API request patterns

Bad extraction candidates:
- helpers used once
- abstractions created only for elegance
- splitting code when ownership becomes less clear

## 6. Rules for communication

### 6.1 Keep updates short

Progress messages should say:
- what is being checked
- what was found
- what will be edited next

Do not narrate every command.

### 6.2 Do not restate repository contents

Avoid long summaries of files, framework choices, or already known architecture unless the user asked for it.

### 6.3 Use compressed final reporting

Final response should contain only:
- what changed
- how it was verified
- any remaining risk or blocker

Do not paste large code blocks unless requested.

## 7. Rules for testing and verification

### 7.1 Test only the affected surface first

Preferred verification order:
1. typecheck or targeted lint for changed area
2. narrow unit/integration test if it exists
3. broader test suite only when needed

### 7.2 Do not run expensive commands blindly

Avoid broad builds or full suites when:
- the edit is documentation-only
- the change is narrowly scoped and can be verified locally
- the full suite is known to be heavy and not required yet

### 7.3 Report verification honestly

Always state:
- what was run
- what was not run
- why something was skipped

This avoids repeated follow-up exploration later.

## 8. Rules for token-heavy scenarios

### 8.1 Large files

When working with large files:
- inspect symbols with search first
- open only 80 to 200 relevant lines at a time
- store a summary before moving on
- patch a local area only

### 8.2 Multi-step features

For features spanning frontend and backend:
- confirm the contract first
- change the API shape in one place
- update the exact consumers
- verify the round trip

Do not open every related file "just in case".

### 8.3 Debugging bugs

For debugging:
- reproduce the path conceptually
- inspect logs, route, state transition, or failing branch
- prove the likely cause before editing

Do not shotgun-read unrelated files.

### 8.4 Documentation work

For docs:
- reuse repository terminology
- keep docs action-oriented
- avoid copying architecture into multiple places

If a concept already exists in another doc, link or reference it instead of restating it in full.

## 9. Anti-patterns

The agent should avoid these behaviors:
- opening entire large files without a search step
- reading the same file many times because no interim summary was made
- giving long explanations before touching code
- changing unrelated formatting
- proposing many optional ideas before solving the requested task
- running large test suites without reason
- loading full changelogs or full architecture docs when only one section is needed
- exploring both frontend and backend when one side is enough to answer the question

## 10. Recommended work template

Use this internal sequence for most tasks:

1. Task statement
   Example: "Add validation to import overwrite flow."
2. Scope discovery
   Find the owning files and the exact symbols.
3. Minimal read
   Open only the needed ranges.
4. Edit
   Apply the smallest safe patch.
5. Verify
   Run the narrowest useful check.
6. Close
   Summarize change, verification, and any residual risk.

## 11. Mopay-specific lessons that generalize well

These patterns from Mopay dev are worth applying elsewhere:

- Large central files should be treated as indexed resources, not read sequentially.
- API wrappers and shared stores are high-value files: inspect them early, but narrowly.
- Changelog and architecture docs are reference material, not default reading.
- Frontend work often needs only one component, one API client path, and one store branch.
- Backend work often needs only one route, one helper, and one data access path.
- Small diffs are especially important in mixed frontend/backend repositories because context expands quickly.

## 12. How to reuse these rules in other projects

### Option A: Manual activation

Copy this file into the target repo, for example:
- `docs/agent_rules.md`

Then start the session with a short instruction like:

`Follow the rules from docs/agent_rules.md for this task.`

This is the safest and most portable method.

### Option B: Lightweight automatic activation via root instruction file

In a new repository, add a root-level file such as `AGENTS.md` with content similar to:

```md
# AGENTS

Default instruction for AI agents:

Follow the rules in `docs/agent_rules.md`.
If there is a conflict, repository-specific instructions override generic ones.
```

This works well when your agent tooling automatically reads repository guidance files from the project root.

### Option C: Reusable shared template

Keep one master version of this file outside individual repositories and copy it into new projects as a starting point.

Recommended approach:
- maintain one canonical template
- copy it into `docs/agent_rules.md` when creating a repo
- adjust only the project-specific section if needed

### Option D: Session bootstrap prompt

If the tool does not auto-read project files, use a one-line bootstrap instruction at the beginning of work:

`Use docs/agent_rules.md as the operating policy for exploration, edits, communication, and verification.`

## 13. Local adaptation section for each project

When using this file in another repo, add a short project appendix with:
- main stack
- highest-cost files
- preferred test commands
- forbidden expensive commands
- repo-specific ownership boundaries

This keeps the universal rules stable while letting the agent optimize for the actual codebase.

## 14. Priority order

If tradeoffs appear, follow this order:

1. correctness
2. safety
3. token efficiency
4. speed
5. elegance

Token savings must never justify unsafe or low-confidence changes.
