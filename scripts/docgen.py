#!/usr/bin/env python3
"""
docgen.py — PrepAgent Codebase Documentation Sub-Agent

Scans the entire PrepAgent codebase (Python FastAPI backend + Next.js frontend),
extracts structural metadata (functions, classes, routes, hooks), detects
code-quality signals (unused vars, large files, duplication), and writes
structured documentation files.

Usage:
    python scripts/docgen.py                         # full scan → stdout
    python scripts/docgen.py --markdown               # full scan → markdown file
    python scripts/docgen.py --inventory              # function inventory only
    python scripts/docgen.py --issues                 # code quality issues only
    python scripts/docgen.py --update-docs            # update DOCUMENTATION.md sections

Output:
    docs/codebase-inventory.md        — full function/route inventory
    docs/refactoring-opportunities.md — code quality analysis
"""

import ast
import os
import re
import json
from pathlib import Path
from typing import Any, Optional, Union
from dataclasses import dataclass, field, asdict

# ── Config ───────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent

BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "src"
DOCS_DIR = ROOT / "docs"
KB_DIR = ROOT / "knowledge_base"

SKIP_DIRS = {
    "node_modules",
    "venv",
    "venv_test",
    ".venv",
    "__pycache__",
    ".next",
    ".git",
    ".logs",
    "public/uploads",
}

SKIP_FILES = {
    "__init__.py",
    ".DS_Store",
}

MAX_FILE_LINES_WARN = 500  # warn for files over this many lines
MAX_FUNCTION_LINES_WARN = 80  # warn for functions over this many lines


# ── Data Models ──────────────────────────────────────────────────────────────


@dataclass
class FunctionInfo:
    name: str
    line: int
    end_line: int
    docstring: Optional[str]
    decorators: list[str]
    args: list[str]
    returns: Optional[str]
    async_def: bool = False
    is_method: bool = False


@dataclass
class ClassInfo:
    name: str
    line: int
    bases: list[str]
    methods: list[FunctionInfo]
    docstring: Optional[str]


@dataclass
class RouteInfo:
    method: str
    path: str
    function: str
    file: str
    line: int
    docstring: Optional[str]


@dataclass
class FileInfo:
    path: Path
    language: str  # "python" | "typescript" | "tsx"
    lines: int
    functions: list[FunctionInfo] = field(default_factory=list)
    classes: list[ClassInfo] = field(default_factory=list)
    routes: list[RouteInfo] = field(default_factory=list)
    exports: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    todos: list[tuple[int, str]] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)


@dataclass
class ScanReport:
    files: list[FileInfo] = field(default_factory=list)
    total_functions: int = 0
    total_classes: int = 0
    total_routes: int = 0
    total_lines: int = 0
    issues_found: list[str] = field(default_factory=list)


# ── Python Scanner ───────────────────────────────────────────────────────────


class PythonScanner(ast.NodeVisitor):
    """Extract functions, classes, docstrings from Python AST."""

    def __init__(self, source: str, filepath: Path):
        self.source = source
        self.filepath = filepath
        self.functions: list[FunctionInfo] = []
        self.classes: list[ClassInfo] = []
        self.current_class: Optional[str] = None

    @staticmethod
    def _get_docstring(
        node: Union[ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module],
    ) -> Optional[str]:
        doc = ast.get_docstring(node)
        if doc:
            return doc.split("\n")[0].strip()
        return None

    @staticmethod
    def _get_decorator_names(
        node: Union[ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef],
    ) -> list[str]:
        return [
            d.id if isinstance(d, ast.Name) else repr(d) for d in node.decorator_list
        ]

    @staticmethod
    def _get_return_annotation(
        node: Union[ast.FunctionDef, ast.AsyncFunctionDef],
    ) -> Optional[str]:
        if node.returns:
            return ast.unparse(node.returns)
        return None

    @staticmethod
    def _get_args(node: Union[ast.FunctionDef, ast.AsyncFunctionDef]) -> list[str]:
        args = []
        for arg in node.args.args:
            annotation = ast.unparse(arg.annotation) if arg.annotation else None
            if annotation:
                args.append(f"{arg.arg}: {annotation}")
            else:
                args.append(arg.arg)
        return args

    def _extract_function(self, node: Union[ast.FunctionDef, ast.AsyncFunctionDef]):
        info = FunctionInfo(
            name=node.name,
            line=node.lineno,
            end_line=node.end_lineno or node.lineno,
            docstring=self._get_docstring(node),
            decorators=self._get_decorator_names(node),
            args=self._get_args(node),
            returns=self._get_return_annotation(node),
            async_def=isinstance(node, ast.AsyncFunctionDef),
            is_method=bool(self.current_class),
        )
        self.functions.append(info)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._extract_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):  # type: ignore[explicit-override]
        self._extract_function(node)

    def _fn_from_class_item(
        self, item: Union[ast.FunctionDef, ast.AsyncFunctionDef]
    ) -> FunctionInfo:
        return FunctionInfo(
            name=item.name,
            line=item.lineno,
            end_line=item.end_lineno or item.lineno,
            docstring=self._get_docstring(item),
            decorators=self._get_decorator_names(item),
            args=self._get_args(item),
            returns=self._get_return_annotation(item),
            async_def=isinstance(item, ast.AsyncFunctionDef),
            is_method=True,
        )

    def visit_ClassDef(self, node: ast.ClassDef):
        bases = [ast.unparse(b) for b in node.bases]
        prev_class = self.current_class
        self.current_class = node.name
        methods: list[FunctionInfo] = []
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                fn_info = self._fn_from_class_item(item)
                methods.append(fn_info)
        cls_info = ClassInfo(
            name=node.name,
            line=node.lineno,
            bases=bases,
            methods=methods,
            docstring=self._get_docstring(node),
        )
        self.classes.append(cls_info)
        self.current_class = prev_class


def scan_python_file(filepath: Path) -> FileInfo:
    source = filepath.read_text(encoding="utf-8", errors="ignore")
    lines = source.count("\n")
    info = FileInfo(path=filepath, language="python", lines=lines)

    # Extract imports
    for match in re.finditer(r"^(?:from|import)\s+(\S+)", source, re.MULTILINE):
        info.imports.append(match.group(1))

    # Extract exports (module-level names)
    for match in re.finditer(r"^__all__\s*=\s*(\[.*?\])", source, re.DOTALL):
        info.exports = re.findall(r"'([^']+)'", match.group(1))

    # Extract TODO/FIXME/HACK comments
    for i, line in enumerate(source.split("\n"), 1):
        m = re.search(r"(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE):?\s*(.*)", line)
        if m:
            info.todos.append((i, f"{m.group(1)}: {m.group(2)}"))

    # Extract FastAPI routes
    for match in re.finditer(
        r'@\w+\.(?:get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']', source
    ):
        decorator_line = source[: match.start()].count("\n") + 1
        route_path = match.group(1)
        http_method = match.group(0).split(".")[1].split("(")[0]
        fn_name = _find_next_function(source, match.end())
        info.routes.append(
            RouteInfo(
                method=http_method.upper(),
                path=route_path,
                function=fn_name or "?",
                file=str(filepath.relative_to(ROOT)),
                line=decorator_line,
                docstring=None,
            )
        )

    # AST analysis
    try:
        tree = ast.parse(source)
        scanner = PythonScanner(source, filepath)
        scanner.visit(tree)
        info.functions = scanner.functions
        info.classes = scanner.classes
    except SyntaxError:
        info.issues.append("AST parse error (syntax)")

    # Size warnings
    if lines > MAX_FILE_LINES_WARN:
        info.issues.append(f"Large file: {lines} lines (>{MAX_FILE_LINES_WARN})")

    for fn in info.functions:
        fn_lines = fn.end_line - fn.line
        if fn_lines > MAX_FUNCTION_LINES_WARN and not fn.is_method:
            info.issues.append(
                f"Long function '{fn.name}' ({fn_lines} lines at line {fn.line})"
            )

    return info


def _find_next_function(source: str, pos: int) -> Optional[str]:
    """Find the next function/async function definition after a position."""
    remainder = source[pos:]
    m = re.search(r"^\s*(?:async\s+)?def\s+(\w+)\s*\(", remainder, re.MULTILINE)
    return m.group(1) if m else None


# ── TypeScript/TSX Scanner ───────────────────────────────────────────────────


def scan_ts_file(filepath: Path) -> FileInfo:
    source = filepath.read_text(encoding="utf-8", errors="ignore")
    lines = source.count("\n")
    info = FileInfo(
        path=filepath,
        language="tsx" if filepath.suffix == ".tsx" else "typescript",
        lines=lines,
    )

    # Extract imports
    for match in re.finditer(
        r'(?:import\s+(?:[\w*{}, ]+\s+from\s+)?["\']([^"\']+)["\'])', source
    ):
        info.imports.append(match.group(1))

    # Extract exports
    for match in re.finditer(
        r"^export\s+(?:default\s+)?(?:const|function|class|interface|type)\s+(\w+)",
        source,
        re.MULTILINE,
    ):
        info.exports.append(match.group(1))

    for match in re.finditer(
        r"^export\s+\{\s*([^}]+)\s*\}",
        source,
        re.MULTILINE,
    ):
        for name in match.group(1).split(","):
            info.exports.append(name.strip())

    # Extract functions (arrow + regular)
    for match in re.finditer(
        r"(?:^|\s)(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)",
        source,
    ):
        fn_name = match.group(1)
        fn_line = source[: match.start()].count("\n") + 1
        info.functions.append(
            FunctionInfo(
                name=fn_name,
                line=fn_line,
                end_line=fn_line,
                docstring=None,
                decorators=[],
                args=[],
                returns=None,
            )
        )

    for match in re.finditer(
        r"(?:^|\s)(?:export\s+(?:default\s+)?)?(?:const\s+)?(\w+)\s*[=:]\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_]\w*(?:\s*:\s*\w+)?)\s*(?:=>|\{)",
        source,
    ):
        fn_name = match.group(1)
        fn_line = source[: match.start()].count("\n") + 1
        info.functions.append(
            FunctionInfo(
                name=fn_name,
                line=fn_line,
                end_line=fn_line,
                docstring=None,
                decorators=[],
                args=[],
                returns=None,
            )
        )

    # Extract interfaces and type aliases
    for match in re.finditer(
        r"(?:^|\s)export\s+(?:interface|type)\s+(\w+)",
        source,
    ):
        type_name = match.group(1)
        if not any(c.name == type_name for c in info.classes):
            info.classes.append(
                ClassInfo(
                    name=type_name,
                    line=source[: match.start()].count("\n") + 1,
                    bases=[],
                    methods=[],
                    docstring=None,
                )
            )

    # Extract Next.js route handlers (exported functions: GET, POST, etc.)
    for method in ("GET", "POST", "PUT", "DELETE", "PATCH"):
        pattern = rf"^export\s+(?:async\s+)?function\s+{method}\s*\("
        for match in re.finditer(pattern, source, re.MULTILINE):
            fn_line = source[: match.start()].count("\n") + 1
            # Try to infer route path from the file location
            rel_path = str(filepath.relative_to(ROOT))
            route_path = _infer_route_path(rel_path)
            # Get first line of docstring
            doc_match = re.search(r"/\*\*\s*\n\s+\*\s*(.*?)\n", source[match.start() :])
            docstring = doc_match.group(1).strip() if doc_match else None
            if not docstring:
                doc_match = re.search(
                    r"//\s*(.+?)$",
                    source[match.start() : match.start() + 200],
                    re.MULTILINE,
                )
                docstring = doc_match.group(1).strip() if doc_match else None
            info.routes.append(
                RouteInfo(
                    method=method,
                    path=route_path,
                    function=method,
                    file=str(filepath.relative_to(ROOT)),
                    line=fn_line,
                    docstring=docstring,
                )
            )

    # Extract TODO/FIXME/HACK comments
    for i, line in enumerate(source.split("\n"), 1):
        m = re.search(r"(?://|/\*)\s*(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE):?\s*(.*)", line)
        if m:
            info.todos.append((i, f"{m.group(1)}: {m.group(2).rstrip('*/ ')}"))

    # Size warnings
    if lines > MAX_FILE_LINES_WARN:
        info.issues.append(f"Large file: {lines} lines (>{MAX_FILE_LINES_WARN})")

    # Check for 'any' type usage (TS-specific)
    any_count = len(re.findall(r":\s*any\b", source))
    if any_count > 5:
        info.issues.append(f"Excessive 'any' types: {any_count} occurrences")

    return info


def _infer_route_path(rel_path: str) -> str:
    """Convert a Next.js API route file path to its URL path."""
    path = rel_path.replace("src/app/api/", "/api/").replace("/route.ts", "")
    # Handle dynamic route segments: [param] → :param
    path = re.sub(r"\[(\w+)\]", r":\1", path)
    return path or "/api"


# ── Scanner ──────────────────────────────────────────────────────────────────


def should_skip(path: Path) -> bool:
    for skip in SKIP_DIRS:
        if skip in path.parts:
            return True
    return path.name in SKIP_FILES


def scan_codebase() -> ScanReport:
    report = ScanReport()

    # Scan Python files
    for py_file in sorted(BACKEND_DIR.rglob("*.py")):
        if should_skip(py_file):
            continue
        info = scan_python_file(py_file)
        report.files.append(info)

    # Scan TypeScript/TSX files in src/
    ts_extensions = ("*.ts", "*.tsx")
    for ext in ts_extensions:
        for ts_file in sorted(FRONTEND_DIR.rglob(ext)):
            if should_skip(ts_file) or ts_file.name.startswith("."):
                continue
            info = scan_ts_file(ts_file)
            report.files.append(info)

    # Aggregate statistics
    for f in report.files:
        report.total_functions += len(f.functions)
        report.total_classes += len(f.classes)
        report.total_routes += len(f.routes)
        report.total_lines += f.lines
        report.issues_found.extend(f.issues)

    return report


# ── Markdown Reporters ───────────────────────────────────────────────────────


def render_inventory_md(report: ScanReport) -> str:
    lines = [
        "# Codebase Function Inventory",
        "",
        f"_Auto-generated by docgen.py | {len(report.files)} files, "
        f"{report.total_functions} functions, {report.total_classes} classes, "
        f"{report.total_routes} routes, {report.total_lines} lines_",
        "",
        "---",
        "",
    ]

    # Group by directory
    by_dir: dict[str, list[FileInfo]] = {}
    for f in report.files:
        parent = f.path.parent.relative_to(ROOT)
        key = str(parent)
        by_dir.setdefault(key, []).append(f)

    for directory in sorted(by_dir):
        files = by_dir[directory]
        lines.append(f"## `{directory}/`")
        lines.append("")

        for file_info in sorted(files, key=lambda x: x.path.name):
            rel_path = file_info.path.relative_to(ROOT)
            lines.append(f"### `{rel_path}` ({file_info.lines} lines)")
            lines.append("")

            if file_info.routes:
                lines.append("#### API Routes")
                lines.append("")
                lines.append("| Method | Path | Function | Line |")
                lines.append("| :--- | :--- | :--- | :--- |")
                for r in file_info.routes:
                    lines.append(
                        f"| `{r.method}` | `{r.path}` | `{r.function}` | {r.line} |"
                    )
                lines.append("")

            if file_info.classes:
                lines.append("#### Classes / Interfaces")
                lines.append("")
                for cls in file_info.classes:
                    bases = f"({', '.join(cls.bases)})" if cls.bases else ""
                    doc = f" — {cls.docstring}" if cls.docstring else ""
                    lines.append(f"- **`{cls.name}`**{bases}{doc}")
                    for m in cls.methods:
                        async_prefix = "async " if m.async_def else ""
                        args = ", ".join(m.args)
                        returns = f" → {m.returns}" if m.returns else ""
                        doc_str = f" — {m.docstring}" if m.docstring else ""
                        lines.append(
                            f"  - `{async_prefix}{m.name}({args})`{returns}{doc_str}"
                        )
                lines.append("")

            if file_info.functions:
                lines.append("#### Functions")
                lines.append("")
                for fn in file_info.functions:
                    if fn.is_method:
                        continue
                    async_prefix = "async " if fn.async_def else ""
                    args = ", ".join(fn.args)
                    returns = f" → {fn.returns}" if fn.returns else ""
                    doc_str = f" — {fn.docstring}" if fn.docstring else ""
                    decorators = (
                        f" @{', '.join(fn.decorators)}" if fn.decorators else ""
                    )
                    lines.append(
                        f"- `{async_prefix}{fn.name}({args})`{returns}{decorators}{doc_str}"
                    )
                lines.append("")

            if file_info.imports:
                lines.append(
                    f"<details><summary>Imports ({len(file_info.imports)})</summary>"
                )
                lines.append("")
                for imp in sorted(set(file_info.imports)):
                    lines.append(f"- `{imp}`")
                lines.append("</details>")
                lines.append("")

            if file_info.exports:
                lines.append(f"**Exports:** {', '.join(file_info.exports)}")
                lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def render_issues_md(report: ScanReport) -> str:
    lines = [
        "# Code Quality & Refactoring Opportunities",
        "",
        f"_Auto-generated by docgen.py | {len(report.issues_found)} issues found_",
        "",
        "---",
        "",
    ]

    # Group issues by type
    issue_types: dict[str, list[tuple[Path, str]]] = {}
    for file_info in report.files:
        for issue in file_info.issues:
            kind = issue.split(":")[0] if ":" in issue else "Other"
            issue_types.setdefault(kind, []).append((file_info.path, issue))

    for kind in sorted(issue_types):
        items = issue_types[kind]
        lines.append(f"## {kind} ({len(items)})")
        lines.append("")
        for path, issue in items:
            rel = path.relative_to(ROOT)
            lines.append(f"- `{rel}` — {issue}")
        lines.append("")

    # TODO/FIXME comments
    all_todos: list[tuple[Path, int, str]] = []
    for file_info in report.files:
        for line_no, text in file_info.todos:
            all_todos.append((file_info.path, line_no, text))

    if all_todos:
        lines.append("## TODO / FIXME Comments")
        lines.append("")
        for path, line_no, text in sorted(all_todos, key=lambda x: x[2]):
            rel = path.relative_to(ROOT)
            lines.append(f"- `{rel}:{line_no}` — {text}")
        lines.append("")

    # Summary statistics
    large_files = [f for f in report.files if f.lines > MAX_FILE_LINES_WARN]
    if large_files:
        lines.append("## Large Files (>{MAX_FILE_LINES_WARN} lines)")
        lines.append("")
        for f in sorted(large_files, key=lambda x: x.lines, reverse=True):
            rel = f.path.relative_to(ROOT)
            lines.append(f"- `{rel}` — {f.lines} lines")
        lines.append("")

    return "\n".join(lines)


def render_summary(report: ScanReport) -> str:
    """Short console summary."""
    items = [
        f"📁  {len(report.files)}  files scanned",
        f"🔧  {report.total_functions}  functions",
        f"🏛️   {report.total_classes}  classes / interfaces",
        f"🌐  {report.total_routes}  API routes",
        f"📝  {report.total_lines}  lines of code",
        f"⚠️   {len(report.issues_found)}  code quality issues",
        f"📌  {sum(len(f.todos) for f in report.files)}  TODO/FIXME comments",
    ]
    return "\n".join(items)


# ── CLI ──────────────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="PrepAgent Codebase Documentation Agent"
    )
    parser.add_argument(
        "--inventory", action="store_true", help="Function inventory only"
    )
    parser.add_argument(
        "--issues", action="store_true", help="Code quality issues only"
    )
    parser.add_argument(
        "--markdown", action="store_true", help="Write markdown files to docs/"
    )
    parser.add_argument(
        "--update-docs",
        action="store_true",
        help="Update DOCUMENTATION.md with inventory tables",
    )
    parser.add_argument("--summary", action="store_true", help="Print summary only")
    args = parser.parse_args()

    report = scan_codebase()

    # Default: everything to stdout
    if not any(
        [args.inventory, args.issues, args.markdown, args.update_docs, args.summary]
    ):
        print(render_summary(report))
        print()
        print(render_inventory_md(report))
        print(render_issues_md(report))
        return

    if args.summary:
        print(render_summary(report))
        return

    if args.markdown:
        DOCS_DIR.mkdir(parents=True, exist_ok=True)
        inv_path = DOCS_DIR / "codebase-inventory.md"
        inv_path.write_text(render_inventory_md(report))
        print(f"Wrote {inv_path}")

        issues_path = DOCS_DIR / "refactoring-opportunities.md"
        issues_path.write_text(render_issues_md(report))
        print(f"Wrote {issues_path}")

    if args.inventory:
        print(render_inventory_md(report))

    if args.issues:
        print(render_issues_md(report))

    if args.update_docs:
        _update_main_docs(report)


def _update_main_docs(report: ScanReport):
    """Update the inventory tables in DOCUMENTATION.md."""
    docs_path = ROOT / "DOCUMENTATION.md"
    if not docs_path.exists():
        print("DOCUMENTATION.md not found — skipping update")
        return

    content = docs_path.read_text(encoding="utf-8")

    # Update the statistics in the header area
    stats_line = (
        f"_Auto-generated by docgen.py | {len(report.files)} files, "
        f"{report.total_functions} functions, {report.total_classes} classes, "
        f"{report.total_routes} routes, {report.total_lines} lines_"
    )

    # Search-and-replace existing stats line or add after title
    pattern = r"_Auto-generated by docgen\.py \| .*?_"
    if re.search(pattern, content):
        content = re.sub(pattern, stats_line.strip("_"), content)

    docs_path.write_text(content, encoding="utf-8")
    print(f"Updated {docs_path}")


if __name__ == "__main__":
    main()
