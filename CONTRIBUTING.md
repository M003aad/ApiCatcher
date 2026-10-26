# Contributing

Thanks for helping improve ApiCatcher.

## Reporting bugs

- Search the repository issues before opening a new one.
- Include the browser version, extension version, URL of the affected page, and steps to reproduce.
- Attach screenshots or console logs when relevant.
- Label the issue as a bug report and include the observed vs. expected behavior.

## Proposing features

- Open a feature request issue describing the problem and the use case.
- Explain whether the feature depends on `fetch`, `XMLHttpRequest`, cookie handling, or UI changes.
- Include mockups or examples when useful.

## Local development setup

1. Clone the repository.
2. Open the project folder in VS Code or your preferred editor.
3. Load the extension in Chrome/Edge by navigating to `chrome://extensions/` or `edge://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and choose the repository root.
6. Refresh the target webpage before testing the extension.

No environment variables are required for this project.

## Pull request standards

- Keep changes focused and easy to review.
- Update documentation when behavior, permissions, or UI changes.
- Validate the extension by reloading it in the browser and exercising the affected flows.
- Include a clear summary, testing notes, and a link to the related issue or discussion.

## Code style

- Use consistent two-space indentation.
- Keep JavaScript clear and browser-extension friendly.
- Prefer small, readable functions over complex abstractions.
- Preserve the existing Manifest V3 architecture and browser APIs.

## Security

To report a security issue, follow the reporting process in [SECURITY.md](./SECURITY.md).
