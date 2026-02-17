#!/bin/bash
# Check for act() warnings in test output
# Returns exit code 1 if any act() warnings are found

# Run tests and capture both output and exit code
OUTPUT=$(bun run test 2>&1)
TEST_EXIT=$?

# Always show the full test output
echo "$OUTPUT"

# Check for act() warnings
WARNING_COUNT=$(echo "$OUTPUT" | grep -c "act(...)")

if [ "$WARNING_COUNT" -gt 0 ]; then
  echo ""
  echo "❌ Found $WARNING_COUNT act() warning(s) - push blocked"
  exit 1
fi

# Preserve original test exit code
exit $TEST_EXIT
