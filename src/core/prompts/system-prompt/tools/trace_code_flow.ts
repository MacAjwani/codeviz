import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.TRACE_CODE_FLOW

const GENERIC: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "trace_code_flow",
	description:
		"Trace code execution flow through a codebase starting from a specific entry point (component, function, API endpoint, etc.). Use this to help users understand how code flows through the system. The tool performs intelligent code analysis to follow data flow, function calls, and component hierarchies. Returns a structured representation of the code path that will be visualized as an interactive diagram. This is especially useful when users want to understand 'what happens when X' or 'how does Y work'.",
	parameters: [
		{
			name: "entry_point",
			required: true,
			instruction:
				"The starting point for the trace. Can be a file path with optional function/component name (e.g., 'src/components/LoginButton.tsx:handleClick', 'api/auth.ts:login', or just 'src/App.tsx'). Use search_files or list_code_definition_names first if you need to find the entry point.",
			usage: "src/components/LoginButton.tsx:handleClick",
		},
		{
			name: "description",
			required: true,
			instruction:
				"A clear description of what the user wants to understand. This helps guide the tracing to focus on relevant code paths. Be specific about what behavior or flow is being investigated.",
			usage: "What happens when the user clicks the login button",
		},
		{
			name: "max_depth",
			required: false,
			instruction:
				"Maximum depth to trace (number of levels). Defaults to 10. Use lower values (3-5) for high-level overviews, higher values (10-15) for detailed traces. The trace will automatically stop at external boundaries (API calls, database operations) regardless of this value.",
			usage: "8",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NEXT_GEN: ClineToolSpec = {
	...GENERIC,
	variant: ModelFamily.NEXT_GEN,
	description:
		"Trace code execution flow through a codebase to understand data flow and component interactions. Analyzes code starting from an entry point and follows the execution path through functions, components, API calls, and external dependencies. Generates a structured flow representation optimized for visualization. Use this when the user wants to understand code behavior, trace bugs, or learn how features work. The trace intelligently stops at external boundaries and produces detailed explanations for each step.",
}

const NATIVE_GPT_5: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_GPT_5,
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const trace_code_flow_variants = [GENERIC, NEXT_GEN, NATIVE_GPT_5, NATIVE_NEXT_GEN]
