# Vue migration performance baseline

This baseline records the production bundle at the end of Step 0 and defines
repeatable browser measurements for comparison in Step 6. Do not treat pending
browser measurements as collected or complete.

## Production bundle

Measured from commit `98a9832` (Step 0 merged to `main`) with `npm run build`.
The Vite build reports:

| Output                    |         Raw size |    Gzip size |
| ------------------------- | ---------------: | -----------: |
| `dist/assets/index-*.js`  |     62,748 bytes |     16.47 kB |
| `dist/assets/index-*.css` |     13,838 bytes |      3.47 kB |
| **JavaScript + CSS**      | **76,586 bytes** | **19.94 kB** |

Reproduce the measurement from the repository root with:

```powershell
npm ci
npm run build
Get-ChildItem -File dist\assets
```

Record the exact JS and CSS filenames and byte lengths from the generated
`dist\assets` directory. The gzip values are the per-file values reported by
Vite; add them for the total. Do not include copied images or the service worker
in the JavaScript/CSS bundle total, but report separately if Step 6 compares
those assets.

## Browser measurement protocol

Use the production build served with `npm run preview`, not the development
server. Use the same device, browser and version, viewport, device-pixel ratio,
network profile, and cache policy for the Step 1 and Step 6 runs. Record those
conditions with the measurements; do not infer them from another person's
machine.

Collect 10 samples for each metric:

1. **First usable preview:** In browser DevTools Performance, start a trace
   before each page reload. Measure from navigation start to the first frame
   where the background, base character, and selected outfit are visibly drawn
   on the preview canvas. For each run, clear site data and disable the browser
   cache before reloading. Keep the network profile fixed and record its exact
   setting.
2. **Selection-to-paint latency:** Load the app, allow its required and
   selected-category images to finish loading, then select the same already
   loaded wardrobe item. Measure from the input event to the first presented
   frame containing the updated preview. Keep the page, image cache, network
   profile, device, and viewport unchanged between samples.
3. **Canvas redraw count:** In the same trace, count full preview paints for
   each individual item selection and Reset action. A full paint is identified
   by a `clearRect` on the visible preview canvas followed by its drawing
   operations; exclude offscreen PNG-export canvases and redraws caused by
   resizing. Record the count separately for selection and Reset.

For each timing metric, report the median and minimum–maximum range in
milliseconds. For redraw counts, report the median and minimum–maximum count.
Include the sample count and all environment/cache/network conditions beside
the results. Run the same protocol and scenarios again in Step 6.

## Browser results

These measurements were not collected in the Step 1 worktree. The
maintainer-owned browser measurements remain pending. Request: have the
maintainer collect and record these results before making the final Step 6
performance comparison.

| Metric                             | Samples | Median  | Range   | Device / browser / viewport | Network / cache |
| ---------------------------------- | ------: | ------- | ------- | --------------------------- | --------------- |
| First usable preview               | Pending | Pending | Pending | Pending                     | Pending         |
| Selection-to-paint latency         | Pending | Pending | Pending | Pending                     | Pending         |
| Preview redraws per item selection | Pending | Pending | Pending | Pending                     | Pending         |
| Preview redraws per Reset          | Pending | Pending | Pending | Pending                     | Pending         |

## Step 1 validation

- `npm run lint`, `npm run format:check`, `npm run typecheck`, and
  `npm run build` passed.
- Vitest passed: 14 files, 185 tests. Python's sprite tests passed: 3 tests
  using `python -m unittest discover -s tests -p 'test_*.py'`.
- On this Windows worktree, `npm test` runs Vitest successfully but its Python
  command discovers zero tests because the npm script's single-quoted pattern
  is passed literally by `cmd.exe`. The Python tests were run directly with
  `python` instead; the unrelated package script was left unchanged.
