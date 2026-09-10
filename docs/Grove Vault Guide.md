---
tags: [meta]
---

# Grove Vault Guide

This is an [Obsidian](https://obsidian.md) vault, and it is used two ways.

**Standalone** — open the `docs/` folder as a vault. `docs/.obsidian/` carries the
shared config (appearance, enabled core plugins, graph colour groups by folder).

**Mounted in the E: drive vault** — `E:\Vault\01 Projects\Grove Docs` is a directory
junction pointing here, so these notes are searchable alongside everything else in that
vault while still living in the repo under version control. Edits made from either side
are the same files. The project-level note there is `[[Grove]]`, which links back into
these notes.

Because the notes are shared, every note name in here must stay unique against the
E: drive vault — that is why the entry note is `Grove Engineering` and this one is
`Grove Vault Guide` rather than `Home` and `Vault Guide`, which already exist there.

## What belongs here

Intent that code cannot state on its own: why an invariant exists, why a boundary sits
where it does, what a domain term means to this business.

## What does not

Anything the code already says. API signatures, field lists, and file inventories go
stale the moment someone refactors, and a confidently wrong note is worse than no note.
Link to the file and explain the *why* instead.

Never put PHI in a note, including in examples — [[Non-Negotiable Rules|rule 1]] applies
to documentation too.

## Conventions

- **Folders**: `Architecture/` (how the system is built), `Domain/` (revenue cycle
  concepts), `Packages/` (one per `@grove/*`), `Apps/`, `Reference/` (lookups).
- **Links**: wikilinks, shortest form — `[[Claim Lifecycle]]`. Piped links for
  readability: `[[Non-Negotiable Rules|rule 5]]`.
- **Frontmatter**: a `tags` list on every note. Existing tags include `architecture`,
  `domain`, `packages`, `reference`, `security`, `compliance`, `money`, `moc`.
- **`moc`** marks a map-of-content note — [[Grove Engineering]], [[Packages Index]],
  [[Revenue Cycle Overview]].
- **Naming**: package notes are `Package - <name>`, so they group in the file explorer
  and autocomplete together.
- End a note with a `Related:` line so the graph stays connected.

## Keeping it honest

When a note's claim changes in code, update the note in the same commit. A note that
contradicts the code should be corrected or deleted, not left as a second opinion.

---

Start at [[Grove Engineering]].
