#!/usr/bin/env bash
# check-no-eq.sh — Phase 1 stub for the $eq-wrap convention (CVE-2025-23061 defense).
#
# Phase 5 wires this into CI (TEST-07) and tightens the heuristic. For now this
# script is a tripwire: any new Mongoose query that filters by `_id`, `email`,
# `userId`, `googleSub`, or `paddleCustomerId` MUST wrap the value in `{ $eq: ... }`.
#
# Allowed patterns (won't trip):
#   findOne({ email: { $eq: email } })
#   findOne({ _id: { $eq: userId } })
#   updateOne({ userId: { $eq: id } }, ...)
#
# Disallowed patterns (will trip):
#   findOne({ email: email })
#   findOne({ _id: userId })
#   updateOne({ userId: id }, ...)
#
# Exit codes:
#   0 — clean (no unwrapped queries found)
#   1 — at least one violation found (lines printed to stderr)
#   2 — usage error (directory not found)
#
# Usage:
#   bash scripts/check-no-eq.sh        # scan src/
#   bash scripts/check-no-eq.sh path/  # scan a specific path

set -euo pipefail

ROOT="${1:-src}"

if [ ! -d "$ROOT" ]; then
  echo "check-no-eq: directory not found: $ROOT" >&2
  exit 2
fi

# Heuristic: find lines that look like Mongoose filter objects with a sensitive
# key followed by a bare identifier (NOT a `{` opening a $eq wrapper).
# The pattern matches:  `key: identifier` or `key: someVar.field`
# Excludes:              `key: {`, `key: "literal"`, `key: { $eq:`, `key: new ObjectId(`
PATTERN='[[:space:]]*(_id|email|userId|googleSub|paddleCustomerId):[[:space:]]+[a-zA-Z_$][a-zA-Z0-9_$.]*[[:space:],}]'

# Allowlisted lines (these contain a bare key but the value is a wrapped object,
# a literal, or a scoped assignment that's not a Mongoose filter).
ALLOWLIST='\$eq|\$in|new ObjectId|new mongoose|: \{|: "|: '\''|: `|: [0-9]|import |export |interface |type |= \{|=> \{'

HITS=0
while IFS= read -r match; do
  file="${match%%:*}"
  rest="${match#*:}"
  lineno="${rest%%:*}"
  content="${rest#*:}"

  # Skip if the line also contains an allowlist pattern
  if echo "$content" | grep -qE "$ALLOWLIST"; then
    continue
  fi

  echo "check-no-eq: $file:$lineno — unwrapped query value (wrap with { \$eq: ... })" >&2
  echo "  $content" >&2
  HITS=$((HITS + 1))
done < <(grep -RnE "$PATTERN" --include='*.ts' --include='*.tsx' "$ROOT" 2>/dev/null || true)

if [ "$HITS" -gt 0 ]; then
  echo "check-no-eq: $HITS unwrapped Mongoose filter(s) found." >&2
  exit 1
fi

echo "check-no-eq: clean (0 unwrapped Mongoose filters in $ROOT)"
exit 0
