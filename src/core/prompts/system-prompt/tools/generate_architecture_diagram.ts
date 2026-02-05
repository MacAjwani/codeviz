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
		"Analyze workspace and generate an interactive architecture diagram with clustered components. Creates a high-level view of the codebase architecture by grouping files into logical components (5-12 clusters) based on responsibility and dependencies. Use this to understand system structure, identify architectural layers, and visualize component relationships.",
	instruction:
		"This tool performs two phases:\n" +
		"1. ANALYSIS: Scans workspace files, extracts imports/exports, builds dependency graph\n" +
		"2. CLUSTERING: Groups files into 5-12 semantic clusters representing architectural components\n\n" +
		"The resulting diagram shows component-level architecture with dependency relationships.\n\n" +
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
		"Analyze workspace and generate an interactive architecture diagram with clustered components. Creates a high-level view of the codebase architecture by grouping files into logical components (5-12 clusters) based on responsibility and dependencies. Use this to understand system structure, identify architectural layers, and visualize component relationships.",
	instruction:
		GENERIC.instruction +
		"\n\n" +
		"▶ RECOMMENDED WORKFLOW:\n" +
		"1. Call this tool when user asks about architecture or codebase structure\n" +
		"2. Tool will automatically scan files, analyze dependencies, and cluster components\n" +
		"3. Review the generated cluster descriptions in the result\n" +
		"4. Use the diagram to answer architecture questions or plan changes\n\n" +
		"▶ CLUSTERING STRATEGY:\n" +
		"Files are grouped by:\n" +
		"- Shared responsibility (auth, API, UI, data access, utilities)\n" +
		"- File path patterns (src/auth/* likely belong together)\n" +
		"- Dependency relationships (files with many cross-imports)\n" +
		"- Architectural layers (presentation, business logic, data storage)\n\n" +
		"Result: 5-12 clusters representing major architectural components",
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
