# doc-sync

AI-powered documentation sync using Claude Code or Codex.

```
Code changes (PR/branch) → Agent analyzes → Docs updated
```

## Install

### Via npm (recommended)

```bash
npm install -g doc-syncer
```

### From source

```bash
git clone https://github.com/orlan0045/doc-syncer.git
cd doc-syncer
bun install
```

## Prerequisites

You need one of these AI agents installed:

```bash
# Option 1: Claude Code CLI (agent: claude)
npm install -g @anthropic-ai/claude-code
claude  # authenticate once

# Option 2: Codex CLI (agent: codex)
# Follow Codex CLI installation instructions
```

## Setup

Download the example config and customize it:

```bash
# Download example config
curl -o doc-syncer.config.yml https://raw.githubusercontent.com/orlan0045/doc-syncer/main/doc-syncer.config.example.yml

# Edit with your repo paths
nano doc-syncer.config.yml
```

Example configuration:

```yaml
agent: claude
base_branch: main

modes:
  frontend:
    default: true
    code_repo: /path/to/your/code-repo
    docs_repo: /path/to/your/docs-repo
```

## Usage

### Option 1: Config file (recommended)

Run:

```bash
doc-syncer sync                 # run it
doc-syncer sync --dry-run       # preview only
doc-syncer sync --mode backend  # use specific mode from config
```

### Option 2: CLI flags

```bash
doc-syncer sync --code ~/dev/my-app --docs ~/dev/my-app-docs
doc-syncer sync --code ~/dev/my-app --docs ~/dev/my-app-docs --branch feature/xyz
```

## What Happens

1. Gets git diff from your feature branch
2. Passes diff + docs repo access to the selected agent
3. Agent explores docs, understands style, updates what's relevant
4. You review with `git diff`

## Options

```
-m, --mode        Mode preset to use (from config file)
-c, --code-repo   Path to code repository
-d, --docs-repo   Path to documentation repository
-b, --branch      Feature branch (default: current)
    --base        Base branch (default: main)
    --config      Config file (default: doc-syncer.config.yml)
    --dry-run     Preview without running
    --agent       AI agent to run (claude | codex)
-h, --help        Show help
```

## After Running

```bash
cd /path/to/docs-repo
git diff                    # review changes
git add -A && git commit -m "docs: sync with feature/xyz"
```
