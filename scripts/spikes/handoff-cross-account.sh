#!/usr/bin/env bash
# Spike: can a Claude Code session started on account A be resumed on account B?
#
# Usage:
#   scripts/spikes/handoff-cross-account.sh <configDirA> <configDirB> [--thinking]
#
# Both config dirs must already be logged in:
#   CLAUDE_CONFIG_DIR=<dir> claude auth login
# Pass --thinking to force extended thinking in turn 1 (tests signed thinking blocks).
# Uses Haiku with a slim context; costs a few cents per run. Cleans up after itself.
set -euo pipefail

A="${1:?config dir A}"; B="${2:?config dir B}"; THINK="${3:-}"
WORK="$(mktemp -d)"; cd "$WORK"
ENC="$(pwd -P | sed 's#[/.]#-#g')"
SLIM=(--output-format stream-json --verbose --strict-mcp-config --disable-slash-commands --setting-sources project)
MODEL=(--model haiku); [[ "$THINK" == "--thinking" ]] && MODEL=(--model sonnet)
PROMPT1="Remember the codeword PAPAYA-42. Reply with just: noted"
[[ "$THINK" == "--thinking" ]] && PROMPT1="Think step by step about 17*23, then remember the codeword PAPAYA-42. Reply with just: noted"

cleanup() { rm -rf "$WORK" "$A/projects/$ENC" "$B/projects/$ENC"; }
trap cleanup EXIT

echo "== turn 1 on A"
SID="$(CLAUDE_CONFIG_DIR="$A" claude -p "$PROMPT1" "${MODEL[@]}" "${SLIM[@]}" | jq -r 'select(.type=="result") | .session_id')"
echo "session: $SID"

echo "== copy transcript A -> B"
mkdir -p "$B/projects/$ENC"
cp "$A/projects/$ENC/$SID.jsonl" "$B/projects/$ENC/"

echo "== turn 2 on B (resume + fork)"
CLAUDE_CONFIG_DIR="$B" claude -p "What codeword did I give you? One word." --resume "$SID" --fork-session \
  "${MODEL[@]}" "${SLIM[@]}" | jq -c 'select(.type=="result") | {is_error, api_error_status, result}'
