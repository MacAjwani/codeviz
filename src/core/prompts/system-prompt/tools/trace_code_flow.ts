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
		"Create an entity-relationship data flow diagram. Identify all entities (specific methods/functions, UI elements, databases, APIs, etc.) involved in a flow and how data moves between them. The diagram shows what communicates with what, not step-by-step execution. IMPORTANT: Use high granularity - identify SPECIFIC functions (e.g., 'AuthService.login()' not 'AuthService'), SPECIFIC event handlers (e.g., 'LoginButton.onClick' not 'LoginButton'), and SPECIFIC API endpoints.",
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
				'JSON array of entity objects. Each entity MUST have these exact fields:\n\nREQUIRED FIELDS:\n- "label" (string): Specific entity name. Use high granularity - GOOD: "UserModel.validateEmail()", BAD: "UserModel". GOOD: "submitButton.onClick", BAD: "submitButton".\n- "type" (string): Must be one of: "user", "ui_element", "component", "method", "api_endpoint", "database", "external_service", "event_handler", "state_manager"\n- "entityPurpose" (string): What this entity does in the system (1-2 sentences)\n\nOPTIONAL FIELDS (only for entities with code in the codebase):\n- "filePath" (string): Relative path to file (e.g., "src/services/AuthService.ts")\n- "lineNumber" (number): Line where this entity is defined\n\nEXTERNAL ENTITIES: Omit filePath/lineNumber for external services, databases, APIs not in your codebase.\n\nGRANULARITY RULES:\n- Methods: Include class/object name (e.g., "AuthService.login()", "validatePassword()")\n- UI Elements: Include specific element and event (e.g., "loginButton.onClick", "emailInput.onBlur")\n- Components: Use component name (e.g., "LoginForm", "UserAvatar")\n- API Endpoints: Include HTTP method and path (e.g., "POST /api/auth/login")\n- Databases: Use table name or database name (e.g., "users_table", "redis_cache")',
			usage: '[{"label":"User","type":"user","entityPurpose":"Person using the application"},{"label":"loginButton.onClick","type":"event_handler","filePath":"src/components/LoginForm.tsx","lineNumber":23,"entityPurpose":"Event handler that fires when user clicks login button"},{"label":"AuthService.login()","type":"method","filePath":"src/services/AuthService.ts","lineNumber":45,"entityPurpose":"Validates user credentials and initiates session creation"},{"label":"POST /api/auth/login","type":"api_endpoint","filePath":"src/api/routes/auth.ts","lineNumber":12,"entityPurpose":"Backend REST endpoint that authenticates users"},{"label":"users_table","type":"database","entityPurpose":"PostgreSQL table storing user credentials and profile data"}]',
		},
		{
			name: "flows",
			required: true,
			instruction:
				'JSON array of flow objects describing data movement. Each flow MUST have these exact fields:\n\nREQUIRED FIELDS:\n- "fromEntity" (string): Label of source entity (must exactly match an entity label)\n- "toEntity" (string): Label of target entity (must exactly match an entity label)\n- "trigger" (string): What causes this flow (e.g., "click event", "function call", "HTTP request")\n- "dataDescription" (string): What data flows between entities (be specific)\n- "dataFormat" (string): Format of the data (e.g., "JSON", "DOM Event", "JavaScript object", "HTTP POST body", "Custom Event")\n- "sampleData" (string): Example showing the STRUCTURE of the data with field names. REQUIRED - show what fields/properties exist.\n\nSAMPLE DATA RULES:\n- Show field names and example values\n- Use realistic field names from the code\n- For objects: show structure like \'{ username: "user@example.com", password: "***" }\'\n- For events: show relevant properties like \'MouseEvent { type: "click", target: <button> }\'\n- For arrays: show item structure like \'[{ id: 1, name: "Item" }]\'\n- Keep it concise but informative about data structure',
			usage: '[{"fromEntity":"User","toEntity":"loginButton.onClick","trigger":"mouse click","dataDescription":"User mouse click on login button","dataFormat":"DOM MouseEvent","sampleData":"MouseEvent { type: \'click\', clientX: 245, clientY: 132, target: <button> }"},{"fromEntity":"loginButton.onClick","toEntity":"AuthService.login()","trigger":"function call","dataDescription":"Username and password collected from form inputs","dataFormat":"JavaScript object","sampleData":"{ username: \'john@example.com\', password: \'hashed_pw_123\', rememberMe: true }"},{"fromEntity":"AuthService.login()","toEntity":"POST /api/auth/login","trigger":"HTTP POST request","dataDescription":"User credentials sent to backend for validation","dataFormat":"JSON HTTP POST body","sampleData":"{ \'username\': \'john@example.com\', \'password\': \'hashed_pw_123\', \'clientId\': \'web-app\' }"},{"fromEntity":"POST /api/auth/login","toEntity":"users_table","trigger":"SQL query","dataDescription":"Query to verify user credentials exist in database","dataFormat":"SQL SELECT statement","sampleData":"SELECT id, password_hash, email FROM users WHERE username = \'john@example.com\'"}]',
		},
		TASK_PROGRESS_PARAMETER,
	],
}

const NEXT_GEN: ClineToolSpec = {
	...GENERIC,
	variant: ModelFamily.NEXT_GEN,
	description:
		"Create an entity-relationship data flow diagram showing how data moves through a system. First, trace the requested flow to identify: (1) All SPECIFIC entities involved (e.g., SPECIFIC functions like 'UserModel.save()', SPECIFIC event handlers like 'submitButton.onClick', NOT broad entities like 'UserModel' or 'submitButton'). Entities are 'things' that exist: User, UI elements, methods, API endpoints, databases, external services. (2) How data flows between entities - what triggers each flow, what data is passed, in what format, and ALWAYS include sampleData showing the structure/fields. Then call this tool with the entities and flows to generate a visual diagram. Focus on WHAT communicates with WHAT using high granularity.",
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
