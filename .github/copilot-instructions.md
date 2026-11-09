# Pull request conventions

- For a significant requested code, documentation, or asset change, validate the changes, then by default commit, push the branch, and open a pull request against `main` without waiting for a separate request. Do not commit, push, or open a pull request when the user explicitly asks for local-only work or asks not to push or open a pull request.
- Assign every new pull request to the currently authenticated GitHub user by default, unless the user specifies otherwise.
- Add at least one relevant existing repository label to every pull request. Inspect available labels and choose based on the changes; do not invent labels.
- When creating or editing PR descriptions from CLI, provide a real multiline body (for example with `gh pr create --body-file <file>` or a here-string piped to a file) and never pass escaped `\n` sequences in a single-line string.
