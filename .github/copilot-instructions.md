# Pull request conventions

- For a significant requested code, documentation, or asset change, validate the changes, then by default commit, push the branch, and open a pull request against `main` without waiting for a separate request. Do not commit, push, or open a pull request when the user explicitly asks for local-only work or asks not to push or open a pull request.
- Assign every new pull request to the currently authenticated GitHub user by default, unless the user specifies otherwise.
- Add at least one relevant existing repository label to every pull request. Inspect available labels and choose based on the changes; do not invent labels.
- When creating or editing PR descriptions from CLI, provide a real multiline body (for example with `gh pr create --body-file <file>` or a here-string piped to a file) and never pass escaped `\n` sequences in a single-line string.
- Write the PR body file as UTF-8, then read the saved body back from GitHub to verify accents. For documentation-only migration steps, use the existing `documentation` label.

# Application structure and validation

- The app uses Vite and ES modules: `src/main.ts` is the composition root, `src/core/` owns model/state, `src/ui/` owns controllers/presentation, and `src/render/` owns image loading/canvas rendering. Read [architecture](../docs/architecture.md) and [technical constraints](technical-constraints.md) before changing behavior or data.
- The catalog is `src/data/sprite-catalog.ts`; shared TypeScript contracts are in `src/types.ts`. Document each module and public function. Type-check with `tsconfig.json` and `tsconfig.node.json`; do not suppress diagnostics or change runtime behavior just to satisfy types. Existing tests remain JavaScript.
- Full-size PNGs in `assets/sprites/` stay untouched. Runtime WebP and thumbnail assets live in `public/images/`; the generated manifest is `src/data/sprite-manifest.ts`. Use the [add-outfit skill](skills/add-outfit/SKILL.md) for asset/catalog changes.
- Use `npm run dev` for local serving, not a raw static server. `npm run build` produces `dist/`; `npm run preview` serves that build. Pages publishes `dist/`, never the Photoshop exports.
- Automated assistant checks during the Vite migration are `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test`. The maintainer performs browser/rendering/PNG-download checks. CI also verifies optimized sprites and the Vite build; PRs do not deploy.
- Follow [the migration plan](../docs/migration-vite.md): one step per PR. Vite+ is a separate optional step, not part of documentation/type-checking work.
