#!/usr/bin/env bun

/**
 * doc-syncer: AI-powered documentation sync using Claude Code or Codex
 *
 * Usage:
 *   doc-syncer --init
 *   doc-syncer --code ~/dev/app --docs ~/dev/app-docs
 *   doc-syncer --mode <name>
 *   doc-syncer --dry-run
 */

import { $ } from "bun";
import { parseArgs } from "util";
import { resolve, join } from "path";
import { parse as parseYaml } from "yaml";
import { homedir } from "os";

// ============ TYPES ============

interface Config {
  codeRepo: string;
  docsRepo: string;
  baseBranch: string;
  featureBranch?: string;
  dryRun: boolean;
  agent: "claude" | "codex";
  permissions: string[];
  mode?: string;
  promptTemplate?: string;
}

// ============ CONFIG ============

async function initConfig(): Promise<void> {
  const configPath = join(homedir(), ".doc-syncer.yml");
  const configFile = Bun.file(configPath);

  if (await configFile.exists()) {
    console.log(`\n⚠️  Config file already exists: ${configPath}`);
    console.log("\nTo edit it, run:");
    console.log(`   open ${configPath}`);
    console.log("   # or");
    console.log(`   nano ${configPath}\n`);
    return;
  }

  const defaultConfig = `# doc-syncer global configuration
# This file lives in your home directory: ~/.doc-syncer.yml

# Default agent: claude | codex
agent: claude

# Default base branch
base_branch: main

# Default permissions for the agent
permissions:
  - Read
  - Write
  - Edit

# Modes: Configure multiple code/docs repo pairs
# Run with: doc-syncer --mode <name>
modes:
  # Example mode - replace with your actual projects
  my-project:
    default: true  # This mode runs when you don't specify --mode
    code_repo: /path/to/your/code-repo
    docs_repo: /path/to/your/docs-repo

    # Optional: Custom prompt template for this mode
    # Create .doc-syncer-prompt.md in your code repo and reference it here
    # prompt_template: /path/to/your/code-repo/.doc-syncer-prompt.md

  # Add more modes as needed:
  # another-project:
  #   code_repo: /path/to/another/code-repo
  #   docs_repo: /path/to/another/docs-repo
  #   prompt_template: /path/to/another/code-repo/.doc-syncer-prompt.md
`;

  await Bun.write(configPath, defaultConfig);

  console.log(`\n✅ Created config file: ${configPath}\n`);
  console.log("Next steps:");
  console.log("1. Edit the config file and set your repo paths:");
  console.log(`   open ${configPath}`);
  console.log("");
  console.log("2. (Optional) Create custom prompt templates in your code repos:");
  console.log("   touch /path/to/your/code-repo/.doc-syncer-prompt.md");
  console.log("");
  console.log("3. Run doc-syncer:");
  console.log("   doc-syncer sync                    # Uses default mode");
  console.log("   doc-syncer sync --mode my-project  # Uses specific mode");
  console.log("");
}

async function loadConfig(): Promise<Config> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "code-repo": { type: "string", short: "c" },
      "code": { type: "string" },
      "docs-repo": { type: "string", short: "d" },
      "docs": { type: "string" },
      "branch": { type: "string", short: "b" },
      "base": { type: "string" },
      "config": { type: "string" },
      "dry-run": { type: "boolean" },
      "agent": { type: "string" },
      "mode": { type: "string", short: "m" },
      "help": { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // Get command from positionals
  const command = positionals[0];

  // Handle commands
  if (!command) {
    console.error("\n❌ No command provided.\n");
    console.error("Available commands:");
    console.error("  sync    Synchronize documentation based on code changes");
    console.error("  init    Create global config file at ~/.doc-syncer.yml");
    console.error("  help    Show help information\n");
    printHelp();
    process.exit(1);
  }

  if (command === "help") {
    printHelp();
    process.exit(0);
  }

  if (command === "init") {
    await initConfig();
    process.exit(0);
  }

  if (command !== "sync") {
    console.error(`\n❌ Unknown command: ${command}\n`);
    console.error("Available commands:");
    console.error("  sync    Synchronize documentation based on code changes");
    console.error("  init    Create global config file at ~/.doc-syncer.yml");
    console.error("  help    Show help information\n");
    printHelp();
    process.exit(1);
  }

  // Try config file first
  // Priority: --config flag > ~/.doc-syncer.yml > ./doc-syncer.config.yml
  let configPath = values.config;

  if (!configPath) {
    const homeConfig = join(homedir(), ".doc-syncer.yml");
    if (await Bun.file(homeConfig).exists()) {
      configPath = homeConfig;
    } else {
      configPath = "doc-syncer.config.yml";
    }
  }

  const configFile = Bun.file(configPath);
  const configExists = await configFile.exists();

  if (configExists) {
    const content = await configFile.text();
    const yaml = parseYaml(content);

    // Check if modes exist
    if (yaml.modes && typeof yaml.modes === "object") {
      const modeName = values.mode || findDefaultMode(yaml.modes);

      if (!modeName) {
        console.error("\n❌ No default mode found and no --mode specified.");
        console.error(`\nAvailable modes: ${Object.keys(yaml.modes).join(", ")}`);
        console.error(`\nSet default: true on a mode or use --mode <name>\n`);
        process.exit(1);
      }

      const mode = yaml.modes[modeName];
      if (!mode) {
        console.error(`\n❌ Mode "${modeName}" not found in config.`);
        console.error(`\nAvailable modes: ${Object.keys(yaml.modes).join(", ")}\n`);
        process.exit(1);
      }

      // Merge mode config with top-level defaults
      const agent = parseAgent(values.agent ?? mode.agent ?? yaml.agent);
      const permissions = parsePermissions(mode.permissions ?? yaml.permissions);

      return {
        codeRepo: resolve(mode.code_repo || mode.codeRepo),
        docsRepo: resolve(mode.docs_repo || mode.docsRepo),
        baseBranch: mode.base_branch || mode.baseBranch || yaml.base_branch || yaml.baseBranch || "main",
        featureBranch: values.branch || mode.feature_branch || mode.featureBranch,
        dryRun: values["dry-run"] || false,
        agent,
        permissions,
        mode: modeName,
        promptTemplate: mode.prompt_template || mode.promptTemplate || yaml.prompt_template || yaml.promptTemplate,
      };
    }

    // Fallback: no modes, use top-level config (backward compatibility)
    const agent = parseAgent(values.agent ?? yaml.agent);
    const permissions = parsePermissions(yaml.permissions);
    return {
      codeRepo: resolve(yaml.code_repo || yaml.codeRepo),
      docsRepo: resolve(yaml.docs_repo || yaml.docsRepo),
      baseBranch: yaml.base_branch || yaml.baseBranch || "main",
      featureBranch: values.branch || yaml.feature_branch || yaml.featureBranch,
      dryRun: values["dry-run"] || false,
      agent,
      permissions,
      promptTemplate: yaml.prompt_template || yaml.promptTemplate,
    };
  }

  // CLI args
  const codeRepo = values["code-repo"] || values.code;
  const docsRepo = values["docs-repo"] || values.docs;
  const agent = parseAgent(values.agent);

  if (!codeRepo || !docsRepo) {
    // Show clear error message about what's missing
    console.error("\n❌ No configuration found.\n");

    const homeConfigPath = join(homedir(), ".doc-syncer.yml");
    console.error("Checked for config at:");
    console.error(`  • ${homeConfigPath} ${configExists && configPath === homeConfigPath ? "✓" : "✗"}`);
    console.error(`  • ./doc-syncer.config.yml ${configExists && configPath === "doc-syncer.config.yml" ? "✓" : "✗"}`);

    console.error("\nTo fix this, either:");
    console.error("  1. Create a config file:");
    console.error("     doc-syncer --init\n");
    console.error("  2. Or provide paths via CLI:");
    console.error("     doc-syncer --code ~/code/repo --docs ~/docs/repo\n");

    printHelp();
    process.exit(1);
  }

  return {
    codeRepo: resolve(codeRepo),
    docsRepo: resolve(docsRepo),
    baseBranch: values.base || "main",
    featureBranch: values.branch,
    dryRun: values["dry-run"] || false,
    agent,
    permissions: parsePermissions(undefined),
    promptTemplate: undefined,
  };
}

function findDefaultMode(modes: Record<string, any>): string | null {
  for (const [name, config] of Object.entries(modes)) {
    if (config.default === true) {
      return name;
    }
  }
  return null;
}

function parseAgent(value: unknown): "claude" | "codex" {
  if (!value) return "claude";
  const normalized = String(value).toLowerCase();
  if (normalized === "claude" || normalized === "codex") {
    return normalized;
  }
  console.error(`\n❌ Invalid agent: ${value}. Use "claude" or "codex".`);
  process.exit(1);
}

function parsePermissions(value: unknown): string[] {
  const defaultPerms = ["Read", "Write", "Edit"];
  if (!value) return defaultPerms;
  if (Array.isArray(value)) return value.map(String);
  return defaultPerms;
}

function printHelp() {
  console.log(`
doc-syncer: AI-powered documentation sync

Usage:
  doc-syncer <command> [options]

Commands:
  sync              Synchronize documentation based on code changes
  init              Create global config file at ~/.doc-syncer.yml
  help              Show this help information

Options:
  -m, --mode        Mode preset to use (from config file)
  -c, --code-repo   Path to code repository
  -d, --docs-repo   Path to documentation repository
  -b, --branch      Feature branch to analyze (default: current)
      --base        Base branch to diff against (default: main)
      --config      Path to YAML config file (default: ~/.doc-syncer.yml)
      --dry-run     Preview without running the agent
      --agent       AI agent to run (claude | codex)
  -h, --help        Show this help

Examples:
  doc-syncer init                         # Create global config file
  doc-syncer sync                         # Use default mode from config
  doc-syncer sync --mode esign            # Use specific mode
  doc-syncer sync --mode esign --dry-run  # Preview mode
  doc-syncer sync --code ~/dev/app --docs ~/dev/app-docs
`);
}

// ============ GIT HELPERS ============

async function gitDiff(repoPath: string, base: string, branch: string): Promise<string> {
  try {
    const result = await $`git -C ${repoPath} diff ${base}...${branch}`.text();
    return result;
  } catch {
    // Fallback: diff against base directly
    const result = await $`git -C ${repoPath} diff ${base}`.text();
    return result;
  }
}

async function gitCurrentBranch(repoPath: string): Promise<string> {
  const result = await $`git -C ${repoPath} branch --show-current`.text();
  return result.trim();
}

async function gitChangedFiles(repoPath: string, base: string, branch: string): Promise<string[]> {
  try {
    const result = await $`git -C ${repoPath} diff --name-only ${base}...${branch}`.text();
    return result.trim().split("\n").filter(Boolean);
  } catch {
    const result = await $`git -C ${repoPath} diff --name-only ${base}`.text();
    return result.trim().split("\n").filter(Boolean);
  }
}

async function checkIncomingChanges(repoPath: string): Promise<boolean> {
  try {
    // Fetch latest changes
    await $`git -C ${repoPath} fetch --quiet`.quiet();

    // Get current branch
    const branch = await gitCurrentBranch(repoPath);

    // Check if remote tracking branch exists
    const hasRemote = await $`git -C ${repoPath} rev-parse --verify origin/${branch}`.quiet().nothrow();
    if (hasRemote.exitCode !== 0) {
      return false; // No remote branch, no incoming changes
    }

    // Count incoming commits
    const result = await $`git -C ${repoPath} rev-list HEAD..origin/${branch} --count`.text();
    const count = parseInt(result.trim(), 10);
    return count > 0;
  } catch {
    return false; // On any error, assume no incoming changes
  }
}

async function promptUser(question: string, options: string[]): Promise<string> {
  console.log(`\n${question}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const askQuestion = () => {
      readline.question("\nYour choice (1-2): ", (answer: string) => {
        const num = parseInt(answer.trim(), 10);
        if (num >= 1 && num <= options.length) {
          readline.close();
          resolve(options[num - 1]);
        } else {
          process.stdout.write(`Invalid choice. Please enter 1-${options.length}.`);
          askQuestion();
        }
      });
    };
    askQuestion();
  });
}

// ============ AGENT ============

async function runAgent(prompt: string, cwd: string, agent: Config["agent"], permissions: string[]): Promise<string> {
  let command: string[];
  let useStdin = false;

  if (agent === "claude") {
    command = ["claude", "--print"];
    for (const perm of permissions) {
      command.push("--allowedTools", perm);
    }
    useStdin = true; // Claude accepts prompt via stdin
  } else {
    command = ["codex", "exec", prompt];
  }

  const proc = Bun.spawn(command, {
    cwd,
    stdin: useStdin ? "pipe" : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Send prompt via stdin for claude
  if (useStdin && proc.stdin) {
    proc.stdin.write(prompt);
    proc.stdin.end();
  }

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Agent exited with code ${exitCode}: ${stderr}`);
  }

  return output;
}

// ============ MAIN ============

async function main() {
  const config = await loadConfig();
  const agentLabel = config.agent === "claude" ? "Claude Code" : "Codex";

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                        doc-sync                               ║
╚══════════════════════════════════════════════════════════════╝
`);
  if (config.mode) {
    console.log(`📋 Mode:     ${config.mode}`);
  }
  console.log(`📁 Code:     ${config.codeRepo}`);
  console.log(`📄 Docs:     ${config.docsRepo}`);
  console.log(`🎯 Base:     ${config.baseBranch}`);
  console.log(`🏃 Dry run:  ${config.dryRun ? "yes" : "no"}`);
  console.log(`🤖 Agent:    ${agentLabel}`);
  console.log(`🔑 Tools:    ${config.permissions.join(", ")}`);

  // Validate paths
  const codeExists = await Bun.file(`${config.codeRepo}/.git/HEAD`).exists();
  const docsExists = await Bun.file(`${config.docsRepo}/.git/HEAD`).exists();

  if (!codeExists) {
    console.error(`\n❌ Code repo not found: ${config.codeRepo}`);
    process.exit(1);
  }
  if (!docsExists) {
    console.error(`\n❌ Docs repo not found: ${config.docsRepo}`);
    process.exit(1);
  }

  // Check for incoming changes in docs repo
  console.log("\n🔍 Checking for incoming changes in docs repo...");
  const hasIncoming = await checkIncomingChanges(config.docsRepo);

  if (hasIncoming) {
    console.log("⚠️  Warning: Docs repo has incoming changes from remote!\n");
    const choice = await promptUser(
      "What would you like to do?",
      ["Ignore and proceed anyway", "Stop and pull latest changes first"]
    );

    if (choice === "Stop and pull latest changes first") {
      console.log("\n❌ Sync stopped.");
      console.log(`\nPlease pull the latest changes first:`);
      console.log(`   cd ${config.docsRepo}`);
      console.log(`   git pull`);
      console.log(`\nThen run doc-syncer again.`);
      process.exit(0);
    }

    console.log("\n⚠️  Proceeding with local changes...\n");
  } else {
    console.log("✅ Docs repo is up to date\n");
  }

  // Get branch
  const branch = config.featureBranch || await gitCurrentBranch(config.codeRepo);
  console.log(`🌿 Branch:   ${branch}\n`);

  // Get diff
  console.log("📊 Getting diff...");
  const diff = await gitDiff(config.codeRepo, config.baseBranch, branch);

  if (!diff.trim()) {
    console.log("✅ No changes found. Nothing to document.");
    process.exit(0);
  }

  const changedFiles = await gitChangedFiles(config.codeRepo, config.baseBranch, branch);
  console.log(`   ${changedFiles.length} files changed\n`);

  // Build prompt
  const prompt = await buildPrompt(config, branch, diff, changedFiles);

  if (config.dryRun) {
    console.log("─".repeat(60));
    console.log("DRY RUN — Would send this prompt to the agent:\n");
    console.log(prompt.slice(0, 2000));
    if (prompt.length > 2000) console.log(`\n... [${prompt.length} chars total]`);
    console.log("─".repeat(60));
    console.log("\nRun without --dry-run to execute.");
    process.exit(0);
  }

  // Run agent
  console.log(`🤖 Running ${agentLabel}...`);

  const startTime = Date.now();
  let timerInterval: Timer | null = null;

  try {
    // Start live timer
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timeStr = minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;
      process.stdout.write(`\r⏱️  Running... ${timeStr}`);
    }, 1000);

    const result = await runAgent(prompt, config.docsRepo, config.agent, config.permissions);

    // Clear timer
    if (timerInterval) clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const timeStr = minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;

    process.stdout.write(`\r✅ Completed in ${timeStr}\n\n`);
    console.log("─".repeat(60));
    console.log(result);
    console.log("─".repeat(60));
    console.log("\n✅ Done. Review changes:");
    console.log(`   cd ${config.docsRepo}`);
    console.log("   git diff");
  } catch (err) {
    if (timerInterval) clearInterval(timerInterval);
    console.error(`\n\n❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

// ============ TEMPLATE HELPERS ============

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

async function resolveTemplatePath(config: Config): Promise<string | null> {
  // Priority order:
  // 1. Config-specified template (mode or global)
  // 2. Default prompt-template.md in project root
  // 3. null (fall back to hardcoded prompt)

  const candidates: string[] = [];

  // Add config template if specified
  if (config.promptTemplate) {
    candidates.push(resolve(config.promptTemplate));
  }

  // Add default template
  candidates.push(resolve("prompt-template.md"));

  // Check which one exists
  for (const path of candidates) {
    const exists = await Bun.file(path).exists();
    if (exists) {
      return path;
    }
  }

  return null; // No template found, will use hardcoded
}

async function buildPrompt(
  config: Config,
  branch: string,
  diff: string,
  changedFiles: string[]
): Promise<string> {
  const maxDiff = 80000;
  const truncated = diff.length > maxDiff
    ? diff.slice(0, maxDiff) + `\n\n... [truncated, ${diff.length} chars total]`
    : diff;

  // Try to load template
  const templatePath = await resolveTemplatePath(config);

  if (templatePath) {
    // Use template with variable substitution
    const templateContent = await Bun.file(templatePath).text();

    const variables: Record<string, string> = {
      codeRepo: config.codeRepo,
      docsRepo: config.docsRepo,
      branch: branch,
      baseBranch: config.baseBranch,
      changedFiles: changedFiles.map(f => `- ${f}`).join("\n"),
      changedFilesCount: String(changedFiles.length),
      diff: truncated,
    };

    return renderTemplate(templateContent, variables);
  }

  // Fallback to hardcoded prompt (backwards compatibility)
  return `You are a documentation expert. Update the docs in this repository based on code changes.

## Context
- Code repo: ${config.codeRepo}
- Docs repo: ${config.docsRepo} (you are here)
- Branch: ${branch}
- Base: ${config.baseBranch}

## Changed Files
${changedFiles.map(f => `- ${f}`).join("\n")}

## Diff
\`\`\`diff
${truncated}
\`\`\`

## Task
1. Explore this docs repo — understand structure and style
2. Analyze the code changes — what was added/changed/removed
3. Update relevant documentation — match existing style
4. Report what you changed


You have full user's permissions to write into DOCs directory
Only update docs affected by the changes. Preserve formatting. If nothing needs updating, say so.`;
}

main().catch(console.error);
