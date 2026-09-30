# MYROLL

A React / WebGL2 photo editor with film looks, LUTs, and grain.

```sh
npm ci
npm run dev
```

Open the editor at `http://localhost:3000`. The production grain renderer also
has a dedicated comparison page at `http://localhost:3000/grain-preview.html`:
import a photo or use the gray chart, compare the original, and inspect grain at
100% or 200%. This page is included in production builds and uses the same
`LUTProcessor` as the editor and exports. `public/effects-preview.html` remains
the older, separate experimental effects platform.

The grain model combines density-dependent variance, three independent spatial
scales, and correlated particles. Amount adjusts strength; Size increases
particle diameter in source-image pixels; Fine / Medium / Coarse change the
scale mixture. See [the model and validation notes](docs/film-grain.md).

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:grain
```

The last command runs the real WebGL2 renderer in Chromium and writes images
and numerical results to `grain-validation/`. For an existing Chrome binary,
set `CHROME_EXECUTABLE=/absolute/path/to/chrome`. No browser dependency is added
to the application bundle.
