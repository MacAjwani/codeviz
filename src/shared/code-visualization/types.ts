/**
 * Type definitions for code flow visualization
 * These types define the structure of diagrams that visualize code execution flow
 */

/**
 * System component/layer grouping information
 */
export interface SystemComponent {
	/** Unique identifier for this component */
	id: string

	/** Name of the component (e.g., "View Layer", "Controller", "Data Access") */
	name: string

	/** Description of this component's role in the system */
	description: string

	/** Color for visual distinction (hex color) */
	color?: string
}

/**
 * Complete diagram representation with nodes, edges, and metadata
 */
export interface CodeFlowDiagram {
	/** Starting point of the trace (e.g., "src/components/LoginButton.tsx:handleClick") */
	entryPoint: string

	/** Description of what this diagram represents */
	description: string

	/** Array of nodes representing components, functions, APIs, etc. */
	nodes: FlowNode[]

	/** Array of edges connecting nodes to show data/control flow */
	edges: FlowEdge[]

	/** System components/layers for grouping nodes */
	components?: SystemComponent[]

	/** Metadata about the diagram */
	metadata: DiagramMetadata
}

/**
 * Types of entities in the data flow diagram
 */
export type NodeType =
	| "user" // User entity (initiates interaction)
	| "ui_element" // UI element (button, input, etc.)
	| "component" // React/Vue/Svelte component
	| "method" // Class method or function
	| "api_endpoint" // API endpoint/route
	| "database" // Database
	| "external_service" // External service/API (not in codebase)
	| "event_handler" // Event handler
	| "state_manager" // State management (Redux, Context, etc.)

/**
 * A node in the flow diagram representing an entity in the system
 */
export interface FlowNode {
	/** Unique identifier for this node */
	id: string

	/** Type of entity determines styling and icon */
	type: NodeType

	/** Short descriptor (e.g., "AuthService.login()", "User", "POST /api/auth", "users_db") */
	label: string

	/** Path to the file containing this entity's code (omit for external entities like databases, APIs) */
	filePath?: string

	/** Line number where this entity's code begins (for VSCode deep linking) */
	lineNumber?: number

	/** Purpose of this entity in the larger system */
	entityPurpose: string

	/** Which system component/layer this entity belongs to (e.g., "View", "Model", "Controller") */
	componentLayer?: string

	/** Visual positioning for the diagram (auto-calculated or manual) */
	position?: { x: number; y: number }

	/** Additional metadata specific to this node */
	metadata?: Record<string, any>
}

/**
 * An edge connecting two entities, representing data flow
 */
export interface FlowEdge {
	/** Unique identifier for this edge */
	id: string

	/** ID of the source entity */
	source: string

	/** ID of the target entity */
	target: string

	/** Short trigger descriptor (e.g., "function call", "HTTP POST", "click event") */
	label: string

	/** Type of flow for visual styling */
	type?: "dataflow" | "call" | "render" | "event"

	/** Detailed information about this data flow */
	metadata: {
		/** What triggers this data flow */
		trigger: string

		/** Description of what data flows between entities */
		dataDescription: string

		/** Format of the data (e.g., "JSON", "Event object", "HTTP request", "Function parameters") */
		dataFormat: string

		/** Sample/example data showing structure and fields - REQUIRED */
		sampleData: string
	}
}

/**
 * Metadata about the diagram
 */
export interface DiagramMetadata {
	/** When this diagram was created (timestamp) */
	timestamp: number

	/** Maximum depth that was traced */
	maxDepth: number

	/** Total number of nodes in the diagram */
	totalNodes: number

	/** Programming language of the traced code */
	language?: string

	/** Framework detected in the code (e.g., "react", "express", "django") */
	framework?: string
}

/**
 * Settings for visualization behavior
 */
export interface VisualizationSettings {
	/** Where to store diagram files (e.g., ".vscode/codeviz") */
	storageLocation: string

	/** Whether to automatically layout nodes or use manual positioning */
	autoLayout: boolean

	/** Default layout direction: "TB" (top-bottom), "LR" (left-right), etc. */
	defaultLayoutDirection: "TB" | "LR" | "RL" | "BT"
}

/**
 * Summary information about a saved diagram (for listing)
 */
export interface DiagramInfo {
	/** Unique identifier */
	id: string

	/** Entry point of the trace */
	entryPoint: string

	/** Description */
	description: string

	/** Creation timestamp */
	createdAt: number

	/** Number of nodes in the diagram */
	nodeCount: number
}
