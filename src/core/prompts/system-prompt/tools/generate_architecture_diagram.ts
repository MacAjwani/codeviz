import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.GENERATE_ARCH_DIAGRAM

const GENERIC: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "generate_architecture_diagram",
	description:
		"Analyze workspace and generate a C4 Component diagram (Level C3) with interactive visualization. Creates a high-level view of the codebase architecture by grouping files into logical components (5-12 clusters) based on responsibility and dependencies. Each component includes type classification (controller, service, repository, etc.), technology stack, and responsibilities. Use this to understand system structure, identify architectural layers, and visualize component relationships.",
	instruction:
		"This tool generates a C4 Component diagram (Level 3) showing the architecture of a codebase.\n\n" +
		"C4 MODEL LEVELS:\n" +
		"- C1: System Context - How the system fits in the wider world\n" +
		"- C2: Container - High-level technology choices (apps, databases, services)\n" +
		"- C3: Component - Logical components within a container (THIS TOOL)\n" +
		"- C4: Code - Class/function level details\n\n" +
		"This tool performs two phases:\n" +
		"1. ANALYSIS: Scans workspace files, extracts imports/exports, builds dependency graph\n" +
		"2. CLUSTERING: Groups files into 5-12 semantic clusters representing C4 components\n\n" +
		"The resulting diagram shows:\n" +
		"- Component types (controller, service, repository, component, gateway, database, etc.)\n" +
		"- Technology stack (language, framework, libraries)\n" +
		"- Key responsibilities (2-5 per component)\n" +
		"- Relationships with types (calls, uses, reads_from, writes_to, etc.)\n" +
		"- Communication protocols (HTTP, SQL, Redis, Internal, etc.)\n\n" +
		"WHEN TO USE:\n" +
		"- User asks to see/understand the architecture\n" +
		"- Need high-level codebase overview\n" +
		"- Planning refactoring or adding features\n" +
		"- Onboarding to unfamiliar codebase\n\n" +
		"PERFORMANCE:\n" +
		"- Caches analysis results for fast re-generation\n" +
		"- First run: 20-60 seconds depending on codebase size\n" +
		"- Subsequent runs: < 5 seconds (uses cached inventory)",
	parameters: [
		{
			name: "workspace_path",
			required: false,
			instruction: "Optional: Path to workspace root to analyze. If omitted, uses current working directory.",
			usage: "/Users/username/projects/my-app",
		},
		{
			name: "clustering_hint",
			required: false,
			instruction:
				"Optional: Hint to guide clustering strategy (e.g., 'Focus on backend vs frontend separation', 'Group by feature domain').",
			usage: "Separate authentication, API routes, database access, and UI components",
		},
		{
			name: "use_cache",
			required: false,
			instruction:
				"Optional: Whether to use cached workspace analysis if available. Defaults to 'true'. Set to 'false' to force fresh analysis.",
			usage: "true",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NEXT_GEN: ClineToolSpec = {
	...GENERIC,
	variant: ModelFamily.NEXT_GEN,
	description:
		"Analyze workspace and generate a C4 Component diagram (Level C3) with interactive visualization. Creates a high-level view of the codebase architecture by grouping files into logical components (5-12 clusters) based on responsibility and dependencies. Each component includes type classification (controller, service, repository, etc.), technology stack, and responsibilities.",
	instruction:
		GENERIC.instruction +
		"\n\n" +
		"▶ RECOMMENDED WORKFLOW:\n" +
		"1. Call this tool when user asks about architecture or codebase structure\n" +
		"2. Tool will automatically scan files, analyze dependencies, and cluster components\n" +
		"3. Review the generated cluster descriptions in the result\n" +
		"4. Use the diagram to answer architecture questions or plan changes\n\n" +
		"▶ C4 COMPONENT TYPES (automatically detected):\n" +
		"- controller: HTTP request handlers, API routes\n" +
		"- service: Business logic, orchestration\n" +
		"- repository: Data access layer, database abstraction\n" +
		"- component: UI components (React, Vue, Angular)\n" +
		"- gateway: External API clients, third-party integrations\n" +
		"- database: Database schemas, ORM models\n" +
		"- message_queue: Event queues, message brokers\n" +
		"- cache: Cache layer (Redis, Memcached)\n" +
		"- middleware: Request/response middleware\n" +
		"- utility: Helper functions, shared utilities\n" +
		"- config: Configuration management\n\n" +
		"▶ CLUSTERING STRATEGY:\n" +
		"Files are grouped by:\n" +
		"- C4 component type (controllers together, services together, etc.)\n" +
		"- Shared responsibility (auth controllers, user services, etc.)\n" +
		"- File path patterns (src/auth/* likely belong together)\n" +
		"- Dependency relationships (files with many cross-imports)\n" +
		"- Technology stack (detected from imports)\n\n" +
		"Result: 5-12 C4 components representing major architectural building blocks",
}

const NATIVE_GPT_5: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_GPT_5,
	instruction:
		NEXT_GEN.instruction +
		"\n\n" +
		"▶ CACHE BEHAVIOR:\n" +
		"- First run analyzes all TypeScript/JavaScript files in workspace\n" +
		"- Results cached to .vscode/codeviz/architecture/inventory.json\n" +
		"- Subsequent runs reuse cached analysis (much faster)\n" +
		"- Set use_cache='false' to force fresh analysis if files changed significantly",
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const generate_architecture_diagram_variants = [GENERIC, NEXT_GEN, NATIVE_GPT_5, NATIVE_NEXT_GEN]
