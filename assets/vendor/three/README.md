# Three.js — locally hosted vendor files

Version: **0.186.1**. Source: the official `three@0.186.1` npm package.
License: MIT; the full upstream license is included in `LICENSE`.

`three.module.js` and `three.core.js` are the upstream build files, minified individually with esbuild 0.28.2. Relative module imports are preserved. There are no CDN requests at runtime and no additional website build step.

To refresh the files, download a specific Three.js version with `npm pack`, extract it outside the repository, and minify both build files with:

```sh
esbuild /path/to/three/build/three.module.js --minify --outfile=assets/vendor/three/three.module.js --legal-comments=inline
esbuild /path/to/three/build/three.core.js --minify --outfile=assets/vendor/three/three.core.js --legal-comments=inline
```

Copy that version's `LICENSE` alongside the files. Keep the two modules from the same release. The editable scene lives at the repository root in `scene.js`.
