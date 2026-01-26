# Cline - AI Coding Assistant VS Code Extension

## What This Is

Cline is a VS Code extension that provides an autonomous AI coding assistant powered by multiple LLM providers (Anthropic Claude, OpenAI, Google Gemini, etc.). The assistant can read/edit files, run terminal commands, use a browser, and integrate with external tools via Model Context Protocol (MCP).

**Purpose:** Enable AI-assisted software development with human-in-the-loop approval for file changes and command execution.

## Tech Stack

**Core:**
- TypeScript (strict mode)
- VS Code Extension API 1.84.0+
- React + Tailwind CSS + Vite (webview UI)
- Protocol Buffers (proto3) for type-safe IPC
- gRPC over VS Code message passing
- SQLite (better-sqlite3) for persistence
- esbuild for bundling

**Key Libraries:**
- 40+ LLM provider SDKs (Anthropic, OpenAI, Google GenAI, Ollama, etc.)
- Puppeteer (browser automation)
- Tree-sitter (code parsing)
- @modelcontextprotocol/sdk (MCP integration)

## Project Structure

```
/
├── src/                          # Extension code (TypeScript)
│   ├── core/                     # Core business logic
│   │   ├── api/                  # LLM provider implementations (src/core/api/*.ts)
│   │   ├── task/                 # Task execution engine (src/core/task/index.ts)
│   │   ├── prompts/              # System prompt construction
│   │   │   ├── system-prompt/    # Modular prompt system
│   │   │   │   ├── components/   # Reusable prompt sections
│   │   │   │   ├── tools/        # Tool definitions (25+ tools)
│   │   │   │   └── variants/     # Model-specific overrides
│   │   ├── controller/           # gRPC request handlers (domain-organized)
│   │   │   ├── task/             # Task handlers
│   │   │   ├── ui/               # UI interaction handlers
│   │   │   ├── file/             # File operation handlers
│   │   │   └── grpc-handler.ts   # Main request router (src/core/controller/grpc-handler.ts:1)
│   │   ├── context/              # Context building & management
│   │   └── storage/              # State persistence (src/core/storage/StateManager.ts:1)
│   ├── shared/                   # Shared types, utilities, configuration
│   │   ├── proto-conversions/    # Proto ↔ TypeScript conversions
│   │   └── net.ts                # Proxy-aware networking (CRITICAL: src/shared/net.ts:1)
│   ├── services/                 # External services (telemetry, auth, logging, MCP)
│   ├── integrations/             # Platform integrations (terminal, editor, browser)
│   ├── hosts/                    # Host-specific implementations
│   └── extension.ts              # Extension entry point (src/extension.ts:1)
├── webview-ui/                   # React frontend (separate npm package)
├── proto/                        # Protocol Buffer definitions
│   └── cline/                    # Service definitions (*.proto)
├── src/generated/                # Auto-generated from protos (DO NOT EDIT)
├── .clinerules/                  # Project-specific rules (read these!)
└── .claude/docs/                 # Additional documentation (see below)
```

## Essential Commands

**Development:**
```bash
npm run install:all              # Install all dependencies (extension + webview)
npm run dev                      # Start watch mode (compiles on change)
npm run protos                   # Regenerate proto types (after .proto changes)
```

**Build:**
```bash
npm run compile                  # Compile extension only
npm run build:webview            # Build React webview UI
npm run package                  # Production build
```

**Testing:**
```bash
npm run test                     # Run all tests
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests (VS Code test framework)
npm run test:e2e                 # End-to-end tests (Playwright)
```

**Development Workflow:**
1. Run `npm run dev` to start watch mode
2. Press F5 in VS Code to launch Extension Development Host
3. Make changes - auto-recompiles on save
4. Reload Extension Development Host window (Cmd+R / Ctrl+R)

## Critical Architectural Concepts

**gRPC-over-Message-Passing IPC:**
- Extension and webview communicate via Protocol Buffers
- Proto files in `proto/cline/*.proto` define contracts
- Run `npm run protos` after any proto changes
- See: `.claude/docs/architectural_patterns.md` → "gRPC Communication Pattern"

**State Management:**
- Single source of truth: `StateManager` (src/core/storage/StateManager.ts:1)
- In-memory cache + 500ms debounced disk persistence
- NEVER use VSCode's globalState directly

**Task Execution Loop:**
- Main engine: `src/core/task/index.ts:1`
- Streams LLM responses, executes tools, collects results
- All long-running operations respect `TaskState.abort` flags

**System Prompts:**
- Modular system with model-specific variants
- Base components in `src/core/prompts/system-prompt/components/`
- Variants in `src/core/prompts/system-prompt/variants/`
- After prompt changes: `UPDATE_SNAPSHOTS=true npm run test:unit`

**Networking (CRITICAL):**
- ALWAYS use `fetch` from `@/shared/net`, never global fetch
- Third-party clients MUST use custom fetch: `new OpenAI({ fetch })`
- Required for corporate proxy support
- See: `.clinerules/network.md`

## Key Files to Understand First

| File | Purpose |
|------|---------|
| `src/extension.ts:1` | Extension activation & setup |
| `src/core/controller/grpc-handler.ts:1` | Main request router |
| `src/core/task/index.ts:1` | Task execution engine |
| `src/core/storage/StateManager.ts:1` | State management |
| `src/core/prompts/system-prompt/README.md` | Prompt system overview |
| `src/shared/net.ts:1` | Proxy-aware networking |
| `.clinerules/general.md` | Project-specific rules |
| `.clinerules/network.md` | Networking requirements |

## Additional Documentation

When working on specific areas, check these detailed guides:

- **`.claude/docs/architectural_patterns.md`** - Core patterns used throughout the codebase (gRPC, state management, API handlers, tool execution, etc.)

## Important Conventions

**Adding New Features:**
1. **New API Provider** - Update 3 places: `proto/cline/models.proto`, `convertApiProviderToProto()`, `convertProtoToApiProvider()` (see `.clinerules/general.md` → "Adding a New API Provider")
2. **New Tool** - Update proto, tool definition, handler, variant configs, conversions (see `.clinerules/general.md` → "Adding Tools to System Prompt")
3. **New gRPC Method** - Add to proto, regenerate, create handler, update webview client

**Proto Changes Workflow:**
```bash
# 1. Edit proto file (e.g., proto/cline/task.proto)
# 2. Regenerate code
npm run protos
# 3. Update conversions if needed (src/shared/proto-conversions/)
# 4. Format generated code
npm run format:fix
```

**Testing System Prompts:**
```bash
# After modifying prompts, update snapshots
UPDATE_SNAPSHOTS=true npm run test:unit
```

## Common Pitfalls

1. **Proto changes without regeneration** - Always run `npm run protos` after editing .proto files
2. **Using global fetch** - Breaks proxy support; use `@/shared/net`
3. **Direct VSCode globalState access** - Use StateManager instead
4. **Missing model family detection** - Check `isNextGenModelProvider()` for feature flags
5. **Forgotten snapshot updates** - Run `UPDATE_SNAPSHOTS=true npm run test:unit` after prompt changes
6. **Adding to variants without GENERIC fallback** - Tools need at least a GENERIC variant

## Build Output

- `dist/` - Compiled extension
- `webview-ui/build/` - Compiled React app
- `src/generated/` - Auto-generated proto code (DO NOT EDIT)
- `out/` - Test compilation output
