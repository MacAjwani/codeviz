import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

const id = ClineDefaultTool.TRACE_COMPONENT_EXECUTION

const GENERIC: ClineToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "trace_component_execution",
	description:
		"PREFERRED TOOL for 'walk me through' questions. Traces execution flow through architecture components with animated visualization, step-by-step walkthrough, code references, and example data. Use this when user asks 'what happens when X', 'show me the flow', 'walk me through Y', etc.",
	instruction:
		"✅ THIS IS THE PREFERRED TOOL FOR:\n" +
		"- 'Walk me through what happens when...'\n" +
		"- 'Show me the flow when...'\n" +
		"- 'Trace what happens when...'\n" +
		"- 'What happens when I click X / submit Y / call Z'\n" +
		"- Any question about execution flow or data flow through the system\n\n" +
		"▶ WORKFLOW - FOLLOW THESE STEPS:\n" +
		"1. First, list architecture diagrams to see if any exist\n" +
		"2. If diagrams exist, use the most recent one as base_diagram_id\n" +
		"3. If NO diagrams exist, generate one first (generate_architecture_diagram)\n" +
		"4. Then use this tool to create the execution trace\n\n" +
		"▶ PREREQUISITES:\n" +
		"1. An architecture diagram must already exist (generated via generate_architecture_diagram)\n" +
		"2. You must know the diagram ID (from previous generation or listing)\n" +
		"3. You must have read relevant code files to understand execution flow\n\n" +
		"▶ WORKFLOW:\n" +
		"1. Load the base architecture diagram to understand available components\n" +
		"2. Read code files to understand the execution flow\n" +
		"3. Generate execution steps with componentIds matching the diagram's cluster IDs\n" +
		"4. Include code references (file paths + line numbers) and example data for each step\n" +
		"5. Call this tool with the complete execution_steps array\n\n" +
		"▶ CRITICAL REQUIREMENTS:\n" +
		"- All componentIds in steps MUST match cluster IDs from the base diagram\n" +
		"- Steps should follow actual edges in the diagram when possible\n" +
		"- Each step must include meaningful code references and example data\n" +
		"- Steps form a sequential narrative from entry point to completion",
	parameters: [
		{
			name: "base_diagram_id",
			required: true,
			instruction: "ID of the existing architecture diagram to trace through. Must be a valid cluster graph ID.",
			usage: "arch_1738640123_a7b8c9",
		},
		{
			name: "entry_point",
			required: true,
			instruction:
				"Natural language description of the starting event or action. " +
				"Be specific about what triggers the execution flow.",
			usage: "User clicks the 'Save Todo' button in the TodoForm component",
		},
		{
			name: "execution_steps",
			required: true,
			instruction:
				"JSON array of execution step objects. Each step represents what happens at a component.\n\n" +
				"▶ REQUIRED FIELDS (6):\n\n" +
				'1. "stepNumber" (number) - Sequential step number starting from 1\n' +
				'2. "componentId" (string) - Cluster ID from base diagram (MUST match exactly)\n' +
				'3. "description" (string) - What happens at this step (2-3 sentences)\n' +
				'4. "codeReference" (object) - Where this happens in code:\n' +
				"   - filePath (string): Relative path to file\n" +
				"   - lineNumber (number, optional): Line number\n" +
				"   - snippet (string, optional): 3-5 line code excerpt\n" +
				'5. "exampleData" (object) - Data at this step:\n' +
				'   - format (string): Data format (e.g., "JSON", "SQL Query", "HTTP Request")\n' +
				"   - sample (string): Example data showing structure\n" +
				'6. "transitionTo" (string | null) - Next component ID, or null if final step\n\n' +
				"▶ VALIDATION RULES:\n" +
				"- componentId must exist in base diagram's cluster list\n" +
				"- transitionTo (if not null) should match next step's componentId\n" +
				"- Steps should form a logical execution path\n" +
				"- File paths should be valid and exist in workspace\n\n" +
				"▶ EXAMPLE DATA GUIDELINES:\n" +
				"- Show realistic data structures\n" +
				"- Include field names and types\n" +
				'- For HTTP: { "method": "POST", "body": {...}, "headers": {...} }\n' +
				"- For SQL: SELECT id, name FROM users WHERE id = 123\n" +
				'- For Events: MouseEvent { type: "click", target: <button> }',
			usage:
				"[\n" +
				"  {\n" +
				'    "stepNumber": 1,\n' +
				'    "componentId": "frontend-ui",\n' +
				'    "description": "User clicks the Save Todo button. The TodoForm component validates the input and prepares to send a POST request to the backend API.",\n' +
				'    "codeReference": {\n' +
				'      "filePath": "src/components/TodoForm.tsx",\n' +
				'      "lineNumber": 45,\n' +
				'      "snippet": "const handleSubmit = async () => {\\n  if (!title.trim()) return\\n  await todoService.create(title)\\n}"\n' +
				"    },\n" +
				'    "exampleData": {\n' +
				'      "format": "JSON HTTP POST body",\n' +
				'      "sample": "{ \\"title\\": \\"Buy groceries\\", \\"completed\\": false, \\"userId\\": 42 }"\n' +
				"    },\n" +
				'    "transitionTo": "backend-api"\n' +
				"  },\n" +
				"  {\n" +
				'    "stepNumber": 2,\n' +
				'    "componentId": "backend-api",\n' +
				'    "description": "Backend API receives the POST request, validates the payload, and calls the database service to insert the new todo.",\n' +
				'    "codeReference": {\n' +
				'      "filePath": "backend/src/controllers/TodoController.ts",\n' +
				'      "lineNumber": 28\n' +
				"    },\n" +
				'    "exampleData": {\n' +
				'      "format": "SQL INSERT statement",\n' +
				'      "sample": "INSERT INTO todos (title, completed, user_id, created_at) VALUES (\'Buy groceries\', false, 42, NOW())"\n' +
				"    },\n" +
				'    "transitionTo": null\n' +
				"  }\n" +
				"]",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NEXT_GEN: ClineToolSpec = {
	...GENERIC,
	variant: ModelFamily.NEXT_GEN,
	instruction:
		GENERIC.instruction +
		"\n\n" +
		"▶ CRITICAL - ALWAYS DO THIS FIRST:\n" +
		"When user asks 'walk me through' or 'what happens when' questions:\n" +
		"1. List architecture diagrams (listArchitectureDiagrams)\n" +
		"2. If diagrams exist → use the most recent one\n" +
		"3. If NO diagrams exist → generate one first (generate_architecture_diagram)\n" +
		"4. Then use THIS tool (trace_component_execution) to create the trace\n\n" +
		"DO NOT use trace_code_flow for walkthrough questions - it creates static entity diagrams, not animated execution traces.\n\n" +
		"▶ RECOMMENDED WORKFLOW:\n" +
		"1. First, load the architecture diagram to see available components\n" +
		"2. Read the relevant code files to understand the execution path\n" +
		"3. Identify the sequence of components involved in the flow\n" +
		"4. For each step, determine the code location and data transformation\n" +
		"5. Finally, call this tool with the complete execution_steps array\n\n" +
		"This ensures your trace accurately reflects the actual codebase.",
}

const NATIVE_GPT_5: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_GPT_5,
	instruction:
		NEXT_GEN.instruction +
		"\n\n" +
		"▶ VALIDATION CHECKLIST:\n" +
		"Before calling this tool, verify:\n" +
		"☐ base_diagram_id is valid (from previous generation or listing)\n" +
		"☐ All componentIds in steps match cluster IDs from base diagram\n" +
		"☐ All codeReference filePaths are valid workspace paths\n" +
		"☐ All steps include meaningful descriptions and example data\n" +
		"☐ transitionTo values match the next step's componentId\n" +
		"☐ Steps form a complete narrative from entry to completion",
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const trace_component_execution_variants = [GENERIC, NEXT_GEN, NATIVE_GPT_5, NATIVE_NEXT_GEN]
