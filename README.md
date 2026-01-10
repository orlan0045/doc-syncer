# doc-syncer

AI-powered documentation sync using Claude Code or Codex.

```
Code changes (PR/branch) → Agent analyzes → Docs updated
```

## Prerequisites

### 1. Install Bun

This package requires Bun runtime:

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install an AI agent

You need one of these AI agents installed:

```bash
# Option 1: Claude Code CLI (agent: claude)
npm install -g @anthropic-ai/claude-code
claude  # authenticate once

# Option 2: Codex CLI (agent: codex)
# Follow Codex CLI installation instructions
```

## Install

### For End Users

Install globally with your preferred package manager:

```bash
# Using npm
npm install -g doc-syncer

# Using pnpm
pnpm install -g doc-syncer

# Using Bun
bun install -g doc-syncer
```

After installation, the `doc-syncer` command will be available globally.

### For Development

Clone and link for local development:

```bash
git clone https://github.com/orlan0045/doc-syncer.git
cd doc-syncer
bun install
bun link  # Makes 'doc-syncer' command available globally for testing
```

## Quick Start

### 1. Initialize Config

Creates `~/.doc-syncer.yml` with your global configuration:

```bash
doc-syncer init
```

### 2. Edit Config

Add your project paths to `~/.doc-syncer.yml`:

```yaml
agent: claude
base_branch: main
permissions: [Read, Write, Edit]

modes:
  my-project:
    default: true  # This mode runs by default
    code_repo: /path/to/your/code-repo
    docs_repo: /path/to/your/docs-repo

    # Optional: custom prompt template (see below)
    # prompt_template: /path/to/your/code-repo/.doc-syncer-prompt.md
```

### 3. Run

```bash
doc-syncer sync                 # Uses default mode
doc-syncer sync --dry-run       # Preview without running
doc-syncer sync --mode name     # Use specific mode
```

## Best Practices (Global Install)

**Config location:** `~/.doc-syncer.yml`
- One config file for all your projects
- Personal mode mappings

**Template location:** Each code repo
- Version controlled with your code
- Team-shared prompts
- Example: `/path/to/code/.doc-syncer-prompt.md`

**Why this structure:**
- ✅ Config stays in your home directory (personal)
- ✅ Templates stay in code repos (team-shared, evolve with code)
- ✅ Each project can have different prompt styles

## Usage

### With Config File (Recommended)

```bash
doc-syncer sync                         # Use default mode
doc-syncer sync --mode backend          # Use specific mode
doc-syncer sync --dry-run               # Preview prompt
doc-syncer sync --branch feature/xyz    # Specific branch
```

### With CLI Flags

```bash
doc-syncer sync --code ~/dev/my-app --docs ~/dev/my-app-docs
doc-syncer sync --code ~/dev/my-app --docs ~/dev/my-app-docs --branch feature/xyz
```

## What Happens

1. Gets git diff from your feature branch
2. Passes diff + docs repo access to the selected agent
3. Agent explores docs, understands style, updates what's relevant
4. You review with `git diff`

## Commands & Options

### Commands

```
sync              Synchronize documentation based on code changes
init              Create global config file at ~/.doc-syncer.yml
help              Show help information
```

### Options

```
-m, --mode        Mode preset to use (from config file)
-c, --code-repo   Path to code repository
-d, --docs-repo   Path to documentation repository
-b, --branch      Feature branch (default: current)
    --base        Base branch (default: main)
    --config      Config file (default: ~/.doc-syncer.yml)
    --dry-run     Preview without running
    --agent       AI agent to run (claude | codex)
-h, --help        Show help
```

## Prompt Templates

Customize the agent's instructions using template files with `{{variable}}` syntax.

### Template Resolution

1. **Config-specified template** (if set in mode or global config)
2. **Default `prompt-template.md`** (in project root) * *development-mode only*
3. **Hardcoded fallback** (built-in default) ✅

Templates are **optional** - it works out of the box with the hardcoded prompt!

### Available Variables

- `{{codeRepo}}` - Path to code repository
- `{{docsRepo}}` - Path to docs repository
- `{{branch}}` - Feature branch name
- `{{baseBranch}}` - Base branch for comparison
- `{{changedFiles}}` - Bulleted list of changed files
- `{{changedFilesCount}}` - Number of changed files
- `{{diff}}` - Full git diff output

### Custom Template Example

Create `.doc-syncer-prompt.md` in your code repo:

```markdown
You are a technical writer for {{codeRepo}}.

Update the documentation at {{docsRepo}} based on these {{changedFilesCount}} changes:
{{changedFiles}}

Code diff:
```
{{diff}}
```

Follow our style guide and be concise.
```

Reference it in your config:

```yaml
modes:
  my-project:
    code_repo: /path/to/code
    docs_repo: /path/to/docs
    prompt_template: /path/to/code/.doc-syncer-prompt.md
```

## After Running

```bash
cd /path/to/docs-repo
git diff                    # review changes
git add -A && git commit -m "docs: sync with feature/xyz"
```
