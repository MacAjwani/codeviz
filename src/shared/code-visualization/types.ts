/**
 * Type definitions for code flow visualization
 * These types define the structure of diagrams that visualize code execution flow
 */

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

	/** Metadata about the diagram */
	metadata: DiagramMetadata
}

/**
 * Types of nodes in the flow diagram
 */
export type NodeType =
	| "component" // React/Vue/Svelte component
	| "function" // Regular function
	| "api" // API endpoint/route
	| "database" // Database operation
	| "external" // External service/API call
	| "entry" // Entry point of the trace
	| "hook" // React hook or similar
	| "service" // Service class/module
	| "utility" // Utility/helper function
	| "state" // State management (Redux, Context, etc.)
	| "event" // Event handler

/**
 * A node in the flow diagram representing a component, function, or external dependency
 */
export interface FlowNode {
	/** Unique identifier for this node */
	id: string

	/** Type of node determines styling and icon */
	type: NodeType

	/** Display name (e.g., "LoginButton", "handleSubmit", "POST /api/auth") */
	label: string

	/** Relative path to the file containing this code */
	filePath: string

	/** Line number where this code is located (optional) */
	lineNumber?: number

	// Six pieces of information displayed in the detail modal

	/** What is the responsibility of this component/function? */
	componentResponsibility: string

	/** What data flows into this node? (params, props, state) */
	inputDescription: string

	/** What data flows out of this node? (return values, side effects) */
	outputDescription: string

	/** What is the purpose of the file containing this code? */
	fileResponsibility: string

	/** Explanation of what the relevant code segment does */
	codeSegmentDescription: string

	/** The actual code snippet (for display and linking) */
	codeSegment: string

	/** Visual positioning for the diagram (auto-calculated or manual) */
	position?: { x: number; y: number }

	/** Additional metadata specific to this node */
	metadata?: Record<string, any>
}

/**
 * An edge connecting two nodes, representing data/control flow
 */
export interface FlowEdge {
	/** Unique identifier for this edge */
	id: string

	/** ID of the source node */
	source: string

	/** ID of the target node */
	target: string

	/** Optional label describing the relationship (e.g., "onClick", "fetch", "returns") */
	label?: string

	/** Type of flow this edge represents */
	type?: "dataflow" | "call" | "render" | "event"
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
