#!/usr/bin/env bun

/**
 * doc-syncer CLI entry point
 *
 * Usage:
 *   doc-syncer init
 *   doc-syncer sync [options]
 *   doc-syncer --help
 */

import { join } from "node:path";
import { existsSync, copyFileSync } from "node:fs";

const args = Bun.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "init") {
  handleInit();
} else if (command === "sync") {
  // Remove 'sync' from args and run the sync script
  Bun.argv.splice(2, 1);
  await import("./doc-sync.ts");
} else {
  console.error(`\n❌ Unknown command: ${command}\n`);
  printHelp();
  process.exit(1);
}

function handleInit() {
  const targetFile = join(process.cwd(), "doc-syncer.config.yml");

  // Check if config already exists
  if (existsSync(targetFile)) {
    console.error("❌ Config file already exists: doc-syncer.config.yml");
    console.log("   Delete it first or edit it directly");
    process.exit(1);
  }

  // Find the example config file (relative to this script)
  const exampleFile = join(import.meta.dir, "..", "doc-syncer.config.example.yml");

  if (!existsSync(exampleFile)) {
    console.error("❌ Example config file not found");
    console.log("   Expected at:", exampleFile);
    process.exit(1);
  }

  // Copy the example config
  try {
    copyFileSync(exampleFile, targetFile);
    console.log("✅ Created doc-syncer.config.yml");
    console.log("   Edit this file with your repository paths");
  } catch (error) {
    console.error("❌ Failed to create config file:", error.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
doc-syncer: AI-powered documentation sync

Usage:
  doc-syncer init
  doc-syncer sync [options]

Commands:
  init          Create doc-syncer.config.yml from example
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
  doc-syncer init                           # Create config file
  doc-syncer sync                           # Use default mode
  doc-syncer sync --mode esign              # Use specific mode
  doc-syncer sync --mode esign --dry-run    # Preview mode
  doc-syncer sync --code ~/dev/myapp --docs ~/dev/myapp-docs
`);
}
