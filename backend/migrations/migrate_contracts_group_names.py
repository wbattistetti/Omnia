"""
migrate_contracts_group_names.py
─────────────────────────────────────────────────────────────────────────────
Phase 2 migration: add GroupName to all NLP contract SubDataMapping entries
that are still using the semantic CanonicalKey as the regex group name.

What it does
────────────
1. Scans every key matching  {prefix}dialog:*  in Redis.
2. Recursively walks the RuntimeTask JSON tree looking for nodes that have
   nlpContract.subDataMapping entries where groupName is absent or empty.
3. For each such entry:
   - Generates a deterministic-style GUID: g_[a-f0-9]{12}
   - Writes groupName onto the mapping entry
   - Rewrites (?<canonicalKey>...) → (?<g_xxx>...) in ALL patterns of
     nlpContract.regex.patterns
4. Saves the modified document back to Redis.
5. Is fully idempotent: if groupName already exists and matches the GUID
   format, the key is skipped without any write.

Usage
─────
  python migrate_contracts_group_names.py [options]

Options
  --host        Redis host           (default: localhost)
  --port        Redis port           (default: 6379)
  --prefix      Redis key prefix     (default: omnia:)
  --dry-run     Print changes without writing to Redis
  --verbose     Print every key processed (not just changed ones)

Examples
  # Dry-run — see what would change
  python migrate_contracts_group_names.py --dry-run

  # Real run against staging
  python migrate_contracts_group_names.py --host staging-redis --port 6379

  # Real run against production
  python migrate_contracts_group_names.py --host prod-redis --prefix prod:
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from dataclasses import dataclass, field
from typing import Any

# ── Dependency check ─────────────────────────────────────────────────────────
try:
    import redis
except ImportError:
    sys.exit(
        "ERROR: redis-py is not installed.\n"
        "Install it with:  pip install redis"
    )

# ── Constants ─────────────────────────────────────────────────────────────────

# Regex that matches the technical GUID group name format: g_[a-f0-9]{12}
GUID_PATTERN = re.compile(r"^g_[a-f0-9]{12}$", re.IGNORECASE)

# Matches a named regex group in a pattern string: (?<name>...)
# Capture group 1 = group name, capture group 2 = inner pattern (may be complex)
NAMED_GROUP_RE = re.compile(r"\(\?<([^>]+)>")


# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class MigrationReport:
    migrated: list[str] = field(default_factory=list)
    already_migrated: list[str] = field(default_factory=list)
    skipped_no_contract: list[str] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)
    anomalies: list[str] = field(default_factory=list)


# ── Core logic ────────────────────────────────────────────────────────────────

def generate_group_name() -> str:
    """Generates a .NET-Regex-safe technical group name (no hyphens, no leading digit)."""
    return "g_" + uuid.uuid4().hex[:12]


def is_migrated(group_name: str | None) -> bool:
    """Returns True when group_name already matches the GUID format."""
    return bool(group_name and GUID_PATTERN.match(group_name))


def rewrite_patterns(patterns: list[str], old_name: str, new_name: str) -> list[str]:
    """
    Replaces every occurrence of (?<old_name>...) with (?<new_name>...)
    in every pattern string. Operates on the group-name only; the inner
    pattern expression is left untouched.
    """
    result = []
    for p in patterns:
        p = re.sub(
            r"\(\?<" + re.escape(old_name) + r">",
            f"(?<{new_name}>",
            p,
        )
        result.append(p)
    return result


def migrate_contract(contract: dict[str, Any], node_path: str, report: MigrationReport) -> bool:
    """
    Inspects a single nlpContract dict.
    Returns True when a change was made.
    """
    sub_mapping: dict[str, Any] | None = contract.get("subDataMapping")
    regex_cfg: dict[str, Any] | None = contract.get("regex")

    if not sub_mapping:
        return False  # leaf node without composite mapping — skip

    patterns: list[str] = regex_cfg.get("patterns", []) if regex_cfg else []

    changed = False

    for sub_id, info in sub_mapping.items():
        if not isinstance(info, dict):
            report.anomalies.append(
                f"{node_path}.subDataMapping[{sub_id}]: value is not a dict — skipped"
            )
            continue

        existing_group = info.get("groupName") or ""
        canonical = info.get("canonicalKey") or ""

        if is_migrated(existing_group):
            # Already migrated — verify the pattern contains it.
            found_in_patterns = any(f"(?<{existing_group}>" in p for p in patterns)
            if not found_in_patterns and patterns:
                report.anomalies.append(
                    f"{node_path}.subDataMapping[{sub_id}]: "
                    f"groupName='{existing_group}' is GUID but not found in any pattern."
                )
            continue  # do not touch

        # Need migration
        if not canonical:
            report.anomalies.append(
                f"{node_path}.subDataMapping[{sub_id}]: "
                f"no groupName and no canonicalKey — cannot migrate, skipped."
            )
            continue

        # Verify the canonical name actually appears in the patterns
        present = any(f"(?<{canonical}>" in p for p in patterns)
        if not present and patterns:
            report.anomalies.append(
                f"{node_path}.subDataMapping[{sub_id}]: "
                f"canonicalKey='{canonical}' not found in regex patterns as a group name — "
                f"GroupName will be assigned but patterns are not rewritten."
            )

        new_guid = generate_group_name()
        info["groupName"] = new_guid

        if patterns and present:
            patterns = rewrite_patterns(patterns, canonical, new_guid)
            changed = True
        elif patterns and not present:
            changed = True  # groupName updated even though pattern was already absent

        changed = True

    if changed and regex_cfg is not None and patterns:
        contract["regex"]["patterns"] = patterns

    return changed


def walk_and_migrate(node: Any, path: str, report: MigrationReport) -> bool:
    """
    Recursively walks a RuntimeTask JSON tree.
    Returns True if any change was made anywhere in the subtree.
    """
    if not isinstance(node, dict):
        return False

    changed = False

    # This node may have an nlpContract
    contract = node.get("nlpContract") or node.get("NlpContract")
    if isinstance(contract, dict):
        if migrate_contract(contract, f"{path}.nlpContract", report):
            changed = True

    # Walk subTasks (Newtonsoft may use camelCase or PascalCase)
    for key in ("subTasks", "SubTasks"):
        sub = node.get(key)
        if isinstance(sub, list):
            for i, child in enumerate(sub):
                if walk_and_migrate(child, f"{path}.subTasks[{i}]", report):
                    changed = True

    return changed


def migrate_key(
    r: "redis.Redis",  # type: ignore[name-defined]
    key: str,
    report: MigrationReport,
    dry_run: bool,
    verbose: bool,
) -> None:
    """Loads, migrates, and optionally saves a single Redis key."""
    try:
        raw: str | None = r.get(key)
        if not raw:
            report.skipped_no_contract.append(key)
            return

        doc: Any = json.loads(raw)
        changed = walk_and_migrate(doc, key, report)

        if not changed:
            report.already_migrated.append(key)
            if verbose:
                print(f"  ⬜ Already migrated: {key}")
            return

        if dry_run:
            print(f"  🔵 [DRY-RUN] Would migrate: {key}")
        else:
            r.set(key, json.dumps(doc, ensure_ascii=False))
            print(f"  ✅ Migrated: {key}")

        report.migrated.append(key)

    except Exception as exc:
        report.errors[key] = str(exc)
        print(f"  ❌ Error on {key}: {exc}", file=sys.stderr)


# ── Entry point ───────────────────────────────────────────────────────────────

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Migrate NLP contract SubDataMapping: add GroupName GUID to legacy entries.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--host",    default="localhost", help="Redis host (default: localhost)")
    p.add_argument("--port",    default=6379, type=int, help="Redis port (default: 6379)")
    p.add_argument("--prefix",  default="omnia:",    help="Redis key prefix (default: omnia:)")
    p.add_argument("--dry-run", action="store_true",  help="Print changes without writing")
    p.add_argument("--verbose", action="store_true",  help="Print every key, not just changed ones")
    return p


def print_report(report: MigrationReport, dry_run: bool) -> None:
    label = "[DRY-RUN] " if dry_run else ""
    print()
    print("═" * 60)
    print(f"  {label}MIGRATION REPORT")
    print("═" * 60)
    print(f"  ✅ Migrated          : {len(report.migrated)}")
    print(f"  ⬜ Already migrated  : {len(report.already_migrated)}")
    print(f"  ⬛ Skipped (no data) : {len(report.skipped_no_contract)}")
    print(f"  ❌ Errors            : {len(report.errors)}")
    print(f"  ⚠️  Anomalies         : {len(report.anomalies)}")

    if report.errors:
        print()
        print("  ── Errors ──────────────────────────────────────────")
        for key, msg in report.errors.items():
            print(f"    {key}: {msg}")

    if report.anomalies:
        print()
        print("  ── Anomalies ────────────────────────────────────────")
        for anomaly in report.anomalies:
            print(f"    ⚠️  {anomaly}")

    print("═" * 60)


def main() -> None:
    args = build_arg_parser().parse_args()

    print(f"🔌 Connecting to Redis at {args.host}:{args.port}  prefix='{args.prefix}'")
    if args.dry_run:
        print("⚠️  DRY-RUN mode — no writes will be performed.")
    print()

    r = redis.Redis(host=args.host, port=args.port, decode_responses=True)
    try:
        r.ping()
    except Exception as exc:
        sys.exit(f"ERROR: Cannot connect to Redis: {exc}")

    scan_pattern = f"{args.prefix}dialog:*"
    print(f"🔎 Scanning keys: {scan_pattern}")

    report = MigrationReport()
    count = 0

    for key in r.scan_iter(scan_pattern):
        count += 1
        if args.verbose:
            print(f"  Processing: {key}")
        migrate_key(r, key, report, dry_run=args.dry_run, verbose=args.verbose)

    if count == 0:
        print("  ℹ️  No keys found matching the pattern.")

    print_report(report, dry_run=args.dry_run)

    # Exit with error code if there were any errors
    if report.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
