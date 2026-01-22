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
		"Create a simplified architectural data flow diagram. Prioritize CLARITY over COMPLETENESS.\n\nRULES:\n1. UNIDIRECTIONAL FLOW ONLY: Never generate return/response edges. The graph flows top-to-bottom.\n2. FUNCTIONAL LABELS: Use 'Category: Action' format (e.g., 'Auth: Sign In', 'Data: Store User').\n3. FILTER NOISE: Merge utility functions (crud.*, utils.*, helper.*) into their parent nodes.\n4. GROUP NODES: Assign every node a 'group' (client/server/data) for architectural organization.\n5. LIMIT: Maximum 8 nodes per diagram. Focus on the big picture.",
	parameters: [
		{
			name: "description",
			required: true,
			instruction: "Brief description of what this data flow diagram represents.",
			usage: "User authentication flow",
		},
		{
			name: "entry_point",
			required: true,
			instruction: "The starting point, described functionally. Use 'User Action' for user-initiated flows.",
			usage: "User: Click Login",
		},
		{
			name: "entities",
			required: true,
			instruction:
				'JSON array of entity objects representing architectural components.\n\nREQUIRED FIELDS:\n- "label" (string): FUNCTIONAL description using "Category: Action" format.\n  GOOD: "Auth: Validate Credentials", "Data: Store Session", "UI: Show Error"\n  BAD: "AuthService.validateCredentials()", "handleSubmit", "POST /api/auth"\n- "type" (string): One of: "user", "ui_element", "component", "method", "api_endpoint", "database", "external_service", "event_handler", "state_manager"\n- "group" (string): REQUIRED. One of: "client", "server", "data"\n  - client: UI components, hooks, event handlers, state managers\n  - server: API endpoints, controllers, backend services\n  - data: Databases, external services, caches\n- "entityPurpose" (string): What this step accomplishes (1-2 sentences)\n\nOPTIONAL FIELDS:\n- "codeName" (string): Original code identifier for developers\n- "filePath" (string): Path to file\n- "lineNumber" (number): Line number\n\nFILTER RULES:\n- Merge crud.*, utils.*, helper.* functions into their calling parent\n- Maximum 8 nodes per diagram\n- Focus on KEY architectural boundaries, not every function call',
			usage: '[{"label":"User: Click Login","type":"user","group":"client","entityPurpose":"User initiates the login process"},{"label":"UI: Collect Credentials","type":"component","group":"client","codeName":"LoginForm","entityPurpose":"Captures and validates user input"},{"label":"Auth: Validate User","type":"api_endpoint","group":"server","codeName":"POST /api/auth/login","entityPurpose":"Verifies credentials against stored data"},{"label":"Data: User Store","type":"database","group":"data","entityPurpose":"Persistent storage for user accounts"}]',
		},
		{
			name: "flows",
			required: true,
			instruction:
				'JSON array describing UNIDIRECTIONAL data movement. NO RETURN EDGES.\n\nREQUIRED FIELDS:\n- "fromEntity" (string): Label of source entity (must match)\n- "toEntity" (string): Label of target entity (must match)\n- "trigger" (string): What causes this flow\n- "dataDescription" (string): Plain English description of data passed\n- "dataFormat" (string): General format\n- "sampleData" (string): Example structure\n\nCRITICAL RULES:\n- NEVER create "return", "response", or "callback" edges\n- Flow is ALWAYS from client → server → data (or variations)\n- If A calls B and B returns to A, only show A→B edge\n- Describe what data GOES TO the target, not what comes back',
			usage: '[{"fromEntity":"User: Click Login","toEntity":"UI: Collect Credentials","trigger":"button click","dataDescription":"User interaction triggers form submission","dataFormat":"DOM event","sampleData":"click on login button"},{"fromEntity":"UI: Collect Credentials","toEntity":"Auth: Validate User","trigger":"form submit","dataDescription":"Email and password for authentication","dataFormat":"JSON request","sampleData":"{ email, password }"},{"fromEntity":"Auth: Validate User","toEntity":"Data: User Store","trigger":"database query","dataDescription":"Lookup user by email","dataFormat":"SQL query","sampleData":"SELECT * FROM users WHERE email=?"}]',
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NEXT_GEN: ClineToolSpec = {
	...GENERIC,
	variant: ModelFamily.NEXT_GEN,
	description:
		"Create a simplified architectural data flow diagram. Focus on CLARITY over COMPLETENESS.\n\nKEY RULES:\n1. UNIDIRECTIONAL ONLY: No return/response edges. Flow goes top→bottom.\n2. FUNCTIONAL LABELS: 'Category: Action' format (e.g., 'Auth: Sign In').\n3. GROUP ALL NODES: Assign 'client', 'server', or 'data' to every node.\n4. FILTER NOISE: Merge utilities into parents. Max 8 nodes.\n5. DESCRIBE FUNCTIONALITY: Labels explain WHAT happens, not code names.",
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
