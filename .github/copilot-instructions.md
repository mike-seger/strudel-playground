# Development Instructions

## NEVER grep minified/bundled JS files

**DO NOT** run grep, rg, or similar on files like:
- `/tmp/strudel-bundle.js`
- `/tmp/strudel-web-bundle.js`
- Any file under `node_modules/`
- Any `.min.js` file

These files have lines that are 100s of KB long. Grep output will overwhelm
the terminal, cause unresponsive states, and waste time.

### What to do instead
- Read the **package README/docs** first
- Use `curl -sL` to fetch **source files** from unpkg/npm (e.g. `web.mjs`, not `dist/index.mjs`)
- Check the project's **source repository** on Codeberg/GitHub
- If you must inspect a bundle, use `sed -n 'START,ENDp'` with known line numbers
  or `dd bs=1 skip=X count=Y` to extract small byte-range snippets
