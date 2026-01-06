#!/usr/bin/env bun

/**
 * doc-syncer CLI entry point
 *
 * Usage:
 *   doc-syncer sync [options]
 *   doc-syncer --help
 */

const args = Bun.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "sync") {
  // Remove 'sync' from args and run the sync script
  Bun.argv.splice(2, 1);
  await import("./doc-sync.ts");
} else {
  console.error(`\n❌ Unknown command: ${command}\n`);
  printHelp();
  process.exit(1);
}

function printHelp() {
  console.log(`
doc-syncer: AI-powered documentation sync

Usage:
  doc-syncer sync [options]

Commands:
  sync          Sync documentation based on code changes

Options:
  -m, --mode        Mode preset to use (from config file)
  -c, --code-repo   Path to code repository
  -d, --docs-repo   Path to documentation repository
  -b, --branch      Feature branch to analyze (default: current)
      --base        Base branch to diff against (default: main)
      --config      Path to YAML config file (default: doc-syncer.config.yml)
      --dry-run     Preview without running the agent
      --agent       AI agent to run (claude | codex)
  -h, --help        Show this help

Examples:
  doc-syncer sync                           # Use default mode
  doc-syncer sync --mode esign              # Use specific mode
  doc-syncer sync --mode esign --dry-run    # Preview mode
  doc-syncer sync --code ~/dev/myapp --docs ~/dev/myapp-docs
`);
}
