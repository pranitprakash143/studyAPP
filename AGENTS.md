<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:codebase-documentation -->
# Codebase Documentation

After making significant changes, regenerate documentation:

```bash
python3 scripts/docgen.py --markdown --update-docs
```

This updates `docs/codebase-inventory.md` and `docs/refactoring-opportunities.md`.
See `DOCUMENTATION.md` for the full architecture reference.
<!-- END:codebase-documentation -->
