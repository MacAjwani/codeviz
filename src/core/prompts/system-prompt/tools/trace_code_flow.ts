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
		"Generate a LOW-LEVEL data model documentation diagram showing entity schemas and database relationships. Creates technical reference diagrams with granular entity types (functions, methods, API endpoints, database tables) for code documentation purposes. This is NOT for execution flow - use trace_component_execution for 'what happens when' questions.",
	instruction:
		"⚠️ THIS TOOL IS FOR DATA MODEL DOCUMENTATION ONLY\n" +
		"Creates static entity-relationship diagrams showing:\n" +
		"- Database table schemas and relationships\n" +
		"- API endpoint definitions and request/response structures\n" +
		"- Low-level function/method entity mappings\n" +
		"- Technical reference documentation diagrams\n\n" +
		"▶ NEVER USE THIS TOOL FOR:\n" +
		"❌ 'Walk me through what happens when...'\n" +
		"❌ 'Show me the execution flow...'\n" +
		"❌ 'Trace what happens when I click...'\n" +
		"❌ 'How does the system process...'\n" +
		"❌ Any question about execution, flow, or step-by-step processes\n" +
		"→ For ALL execution/flow questions, use trace_component_execution instead\n\n" +
		"▶ ONLY USE THIS TOOL FOR:\n" +
		"✓ Documenting database schemas and table relationships\n" +
		"✓ Creating API endpoint reference diagrams\n" +
		"✓ Mapping low-level function signatures and data structures\n" +
		"✓ Building technical entity-relationship reference documentation\n\n" +
		"If the user's question contains 'walk', 'flow', 'happens', 'process', 'trace', 'through' - DO NOT use this tool.\n\n" +
		"▶ ENTITY DOCUMENTATION REQUIREMENTS:\n" +
		"1. Entity types must be exact lowercase strings with underscores: 'user', 'ui_element', 'component', 'method', 'api_endpoint', 'database', 'external_service', 'event_handler', 'state_manager'\n" +
		"2. Use high granularity - 'AuthService.login()' not 'AuthService', 'submitButton.onClick' not 'submitButton'\n" +
		"3. Flows must reference entity LABELS (not IDs) - case-sensitive, character-exact matching\n" +
		"4. Every flow must include sampleData showing field structure\n\n" +
		"▶ ENTITY AND FLOW REQUIREMENTS:",
	parameters: [
		{
			name: "description",
			required: true,
			instruction: "Brief description of what this data flow diagram represents.",
			usage: "User authentication flow from login button to session storage",
		},
		{
			name: "entry_point",
			required: true,
			instruction:
				"The starting entity for this flow. Use 'User' for user-initiated flows, or name the first entity that triggers the flow.",
			usage: "User",
		},
		{
			name: "entities",
			required: true,
			instruction:
				"JSON array of entity objects.\n\n" +
				"▶ REQUIRED FIELDS (3):\n\n" +
				'1. "label" (string) - Specific entity name with high granularity\n' +
				'   GOOD: "AuthService.login()", "submitButton.onClick"\n' +
				'   BAD: "AuthService", "submitButton"\n\n' +
				'2. "type" (string) - EXACTLY one of these 9 values (lowercase with underscores):\n' +
				"   • user - the person using the app\n" +
				"   • ui_element - buttons, inputs, forms\n" +
				"   • component - React/Vue/Angular components\n" +
				"   • method - functions, class methods\n" +
				"   • api_endpoint - REST/GraphQL endpoints\n" +
				"   • database - databases, tables\n" +
				"   • external_service - third-party APIs\n" +
				"   • event_handler - event listeners, callbacks\n" +
				"   • state_manager - Redux, Context, stores\n\n" +
				'3. "entityPurpose" (string) - What this entity does in the system (1-2 sentences)\n\n' +
				"▶ OPTIONAL FIELDS (3):\n\n" +
				'4. "filePath" (string) - Relative path to source file (e.g., "src/services/AuthService.ts")\n' +
				'5. "lineNumber" (number) - Line where entity starts\n' +
				'6. "componentLayer" (string) - System component/layer this entity belongs to (e.g., "View", "Controller", "Model", "Data Access", "External Services")\n\n' +
				"▶ WHEN TO OMIT filePath/lineNumber:\n" +
				'- External services (e.g., "Stripe API", "PostgreSQL")\n' +
				'- Browser APIs (e.g., "localStorage")\n' +
				"- Third-party libraries\n\n" +
				"▶ VALIDATION:\n" +
				'- Type must be ONE of the 9 values above (NOT "Function", "UI Element", "Event Listener")\n' +
				"- Labels must be unique across all entities\n" +
				"- Use specific names, not generic categories",
			usage:
				"[\n" +
				"  {\n" +
				'    "label": "User",\n' +
				'    "type": "user",\n' +
				'    "entityPurpose": "Person using the application"\n' +
				"  },\n" +
				"  {\n" +
				'    "label": "loginButton.onClick",\n' +
				'    "type": "event_handler",\n' +
				'    "filePath": "src/components/LoginForm.tsx",\n' +
				'    "lineNumber": 23,\n' +
				'    "entityPurpose": "Event handler that fires when user clicks login button",\n' +
				'    "componentLayer": "View"\n' +
				"  },\n" +
				"  {\n" +
				'    "label": "AuthService.login()",\n' +
				'    "type": "method",\n' +
				'    "filePath": "src/services/AuthService.ts",\n' +
				'    "lineNumber": 45,\n' +
				'    "entityPurpose": "Validates user credentials and initiates session creation",\n' +
				'    "componentLayer": "Controller"\n' +
				"  },\n" +
				"  {\n" +
				'    "label": "POST /api/auth/login",\n' +
				'    "type": "api_endpoint",\n' +
				'    "filePath": "src/api/routes/auth.ts",\n' +
				'    "lineNumber": 12,\n' +
				'    "entityPurpose": "Backend REST endpoint that authenticates users",\n' +
				'    "componentLayer": "API"\n' +
				"  },\n" +
				"  {\n" +
				'    "label": "users_table",\n' +
				'    "type": "database",\n' +
				'    "entityPurpose": "PostgreSQL table storing user credentials and profile data",\n' +
				'    "componentLayer": "Data Storage"\n' +
				"  }\n" +
				"]",
		},
		{
			name: "flows",
			required: true,
			instruction:
				"JSON array of flow objects describing data movement.\n\n" +
				"▶ REQUIRED FIELDS (6):\n\n" +
				'1. "fromEntity" (string) - Source entity LABEL (must match an entity label exactly)\n' +
				'2. "toEntity" (string) - Target entity LABEL (must match an entity label exactly)\n' +
				'3. "trigger" (string) - What causes this flow (e.g., "click event", "function call")\n' +
				'4. "dataDescription" (string) - What data is passed\n' +
				'5. "dataFormat" (string) - Format of data (e.g., "JSON", "DOM Event", "Function parameters")\n' +
				'6. "sampleData" (string) - Example showing field structure (REQUIRED)\n\n' +
				"▶ CRITICAL - LABEL MATCHING:\n" +
				"- Use entity LABELS, NOT entity IDs\n" +
				'- If entity label is "AuthService.login()", flow must use "AuthService.login()"\n' +
				"- Matching is case-sensitive and character-exact\n" +
				'- Example: fromEntity: "loginButton.onClick" (NOT "entity-1-loginbutton-onclick")\n\n' +
				"▶ SAMPLE DATA RULES:\n" +
				"- Show field names and example values\n" +
				'- Objects: { username: "john@example.com", password: "***", rememberMe: true }\n' +
				'- Events: MouseEvent { type: "click", clientX: 100, clientY: 200, target: <button> }\n' +
				'- Arrays: [{ id: 1, name: "Item", status: "active" }]\n' +
				"- SQL: SELECT id, email, created_at FROM users WHERE username = 'john'",
			usage:
				"[\n" +
				"  {\n" +
				'    "fromEntity": "User",\n' +
				'    "toEntity": "loginButton.onClick",\n' +
				'    "trigger": "mouse click",\n' +
				'    "dataDescription": "User mouse click on login button",\n' +
				'    "dataFormat": "DOM MouseEvent",\n' +
				'    "sampleData": "MouseEvent { type: \'click\', clientX: 245, clientY: 132, target: <button> }"\n' +
				"  },\n" +
				"  {\n" +
				'    "fromEntity": "loginButton.onClick",\n' +
				'    "toEntity": "AuthService.login()",\n' +
				'    "trigger": "function call",\n' +
				'    "dataDescription": "Username and password collected from form inputs",\n' +
				'    "dataFormat": "JavaScript object",\n' +
				"    \"sampleData\": \"{ username: 'john@example.com', password: 'hashed_pw_123', rememberMe: true }\"\n" +
				"  },\n" +
				"  {\n" +
				'    "fromEntity": "AuthService.login()",\n' +
				'    "toEntity": "POST /api/auth/login",\n' +
				'    "trigger": "HTTP POST request",\n' +
				'    "dataDescription": "User credentials sent to backend for validation",\n' +
				'    "dataFormat": "JSON HTTP POST body",\n' +
				"    \"sampleData\": \"{ 'username': 'john@example.com', 'password': 'hashed_pw_123', 'clientId': 'web-app' }\"\n" +
				"  },\n" +
				"  {\n" +
				'    "fromEntity": "POST /api/auth/login",\n' +
				'    "toEntity": "users_table",\n' +
				'    "trigger": "SQL query",\n' +
				'    "dataDescription": "Query to verify user credentials exist in database",\n' +
				'    "dataFormat": "SQL SELECT statement",\n' +
				'    "sampleData": "SELECT id, password_hash, email FROM users WHERE username = \'john@example.com\'"\n' +
				"  }\n" +
				"]",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NEXT_GEN: ClineToolSpec = {
	...GENERIC,
	variant: ModelFamily.NEXT_GEN,
	description:
		"Generate LOW-LEVEL data model documentation diagrams for technical reference. Shows entity schemas, database relationships, and API endpoint structures. NOT for execution flow visualization - use trace_component_execution for any 'what happens when' or walkthrough questions.",
	instruction:
		GENERIC.instruction +
		"\n\n" +
		"⚠️ IMPORTANT DISTINCTION:\n" +
		"- THIS TOOL (trace_code_flow): Static data model documentation\n" +
		"- OTHER TOOL (trace_component_execution): Execution flow walkthroughs\n\n" +
		"If user asks about execution, flow, or 'what happens' - use trace_component_execution.\n\n" +
		"▶ RECOMMENDED WORKFLOW FOR DATA MODEL DOCUMENTATION:\n" +
		"1. First, identify all data entities by reading relevant code files\n" +
		"2. For each entity, document its schema and structure\n" +
		"3. Map the static relationships between entities\n" +
		"4. Finally, call this tool with complete entities and flows arrays\n\n" +
		"This creates technical reference documentation, not execution traces.",
}

const NATIVE_GPT_5: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_GPT_5,
	instruction:
		NEXT_GEN.instruction +
		"\n\n" +
		"⛔ CRITICAL - READ BEFORE USING THIS TOOL:\n" +
		"This tool is ONLY for creating static data model documentation diagrams.\n" +
		"If the user's question contains ANY of these words:\n" +
		"  'walk', 'through', 'happens', 'when', 'flow', 'trace', 'execute', 'process', 'step'\n" +
		"Then use trace_component_execution instead, NOT this tool.\n\n" +
		"▶ TYPE VALIDATION CHECKLIST:\n" +
		"Before calling this tool, verify:\n" +
		"☐ User is asking for data model documentation (not execution flow)\n" +
		"☐ All entity types are lowercase with underscores\n" +
		"☐ All flow fromEntity/toEntity values exactly match entity labels\n" +
		"☐ All flows include sampleData field\n" +
		'☐ No entities use "Function", "UI Element", or "Event Listener" as type',
}

const NATIVE_NEXT_GEN: ClineToolSpec = {
	...NEXT_GEN,
	variant: ModelFamily.NATIVE_NEXT_GEN,
}

export const trace_code_flow_variants = [GENERIC, NEXT_GEN, NATIVE_GPT_5, NATIVE_NEXT_GEN]
