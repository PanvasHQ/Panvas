# Contributor roadmap

These are practical contribution targets for the current v0.1.x line. Check open issues before starting work; this list is guidance, not an assignment queue.

## Good first issue

- Correct a small documentation or setup error and add a tested example.
- Improve keyboard labels, focus order, tooltips, or empty states in one UI surface.
- Add regression coverage for an existing repository or utility behavior.
- Profile one slow or noisy path and document the evidence before proposing a fix.
- Improve a small template, browser-compatibility note, or accessible error message.

Keep first contributions narrow and avoid changing persisted data formats.

## Help wanted

- Responsive refinement for notebook, library, PDF, and canvas surfaces.
- PDF navigation, annotation, import, and export UX.
- Canvas/library polish and import/export edge cases.
- Accessibility review across keyboard, focus, contrast, and reduced motion.
- Browser compatibility testing and durable-storage guidance.
- Documentation, localization groundwork, and release-process automation.

Open an issue with a short proposal and test plan before undertaking a multi-surface change.

## Advanced

The following areas require maintainer and architectural review before code is changed:

- Cloud Sync protocol, conflict handling, or Google OAuth.
- Storage schemas, migrations, backup formats, or recovery behavior.
- `NotebookEngine`, `DrawingEngine`, pointer ownership, or renderer layering.
- Electron preload/IPC channels and security policy.
- Data-format changes that affect existing workspaces or exports.

Do not drive-by rewrite these systems. Start with a design note, identify compatibility and recovery impact, and add tests for both Electron and browser paths when the contract is shared.

See [ROADMAP.md](ROADMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [CONTRIBUTING.md](../CONTRIBUTING.md) for context.
