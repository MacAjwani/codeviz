import * as fs from "fs/promises"
import * as path from "path"
import type { CodeFlowDiagram, FlowEdge, FlowNode, NodeType } from "@/shared/code-visualization/types"

export interface TraceRequest {
	entryPoint: string
	description: string
	maxDepth: number
	cwd: string
}

export interface TraceContext {
	visitedFiles: Set<string>
	nodes: Map<string, FlowNode>
	edges: FlowEdge[]
	currentDepth: number
	maxDepth: number
	cwd: string
}

/**
 * Node information parsed from LLM analysis
 */
export interface ParsedNodeInfo {
	id: string
	type: NodeType
	label: string
	filePath?: string
	lineNumber?: number
	entityPurpose: string
}

/**
 * Service for tracing code flow through a codebase.
 * This service coordinates the analysis by reading files and building
 * a graph representation of the code flow.
 */
export class CodeTracingService {
	/**
	 * Parse an entry point string into file path and optional symbol name.
	 * Format: "path/to/file.ts:symbolName" or just "path/to/file.ts"
	 */
	parseEntryPoint(entryPoint: string, cwd: string): { filePath: string; symbolName?: string } {
		const parts = entryPoint.split(":")
		let filePath = parts[0]
		const symbolName = parts.length > 1 ? parts.slice(1).join(":") : undefined

		// Resolve to absolute path if relative
		if (!path.isAbsolute(filePath)) {
			filePath = path.resolve(cwd, filePath)
		}

		return { filePath, symbolName }
	}

	/**
	 * Determine the node type based on file path and context.
	 */
	determineNodeType(filePath: string, symbolName?: string): NodeType {
		const ext = path.extname(filePath).toLowerCase()
		const basename = path.basename(filePath, ext)

		// Component detection
		if (ext === ".tsx" || ext === ".jsx") {
			// Check if it looks like a React component (PascalCase)
			if (symbolName && /^[A-Z]/.test(symbolName)) {
				return "component"
			}
			if (/^[A-Z]/.test(basename)) {
				return "component"
			}
		}

		// API/route detection
		if (filePath.includes("/api/") || filePath.includes("/routes/")) {
			return "api_endpoint"
		}

		// Hook detection (React hooks are event handlers)
		if (symbolName?.startsWith("use") || basename.startsWith("use")) {
			return "event_handler"
		}

		// Utility detection
		if (filePath.includes("/utils/") || filePath.includes("/helpers/") || filePath.includes("/lib/")) {
			return "method"
		}

		// Service detection
		if (filePath.includes("/services/") || basename.endsWith("Service")) {
			return "method"
		}

		// Default to method
		return "method"
	}

	/**
	 * Generate a unique node ID from file path and optional symbol.
	 */
	generateNodeId(filePath: string, symbolName?: string): string {
		const normalizedPath = filePath.replace(/\\/g, "/")
		if (symbolName) {
			return `${normalizedPath}:${symbolName}`
		}
		return normalizedPath
	}

	/**
	 * Create a FlowNode from parsed information.
	 */
	createNode(info: ParsedNodeInfo): FlowNode {
		return {
			id: info.id,
			type: info.type,
			label: info.label,
			filePath: info.filePath,
			lineNumber: info.lineNumber,
			entityPurpose: info.entityPurpose,
		}
	}

	/**
	 * Create a basic FlowNode with minimal information.
	 * Used when we only have file path and symbol name.
	 */
	createBasicNode(filePath: string, symbolName: string | undefined, cwd: string): FlowNode {
		const relativePath = path.relative(cwd, filePath)
		const nodeType = this.determineNodeType(filePath, symbolName)
		const id = this.generateNodeId(relativePath, symbolName)
		const label = symbolName || path.basename(filePath)

		return {
			id,
			type: nodeType,
			label,
			filePath: relativePath,
			lineNumber: 1,
			entityPurpose: `Pending analysis of ${label}`,
		}
	}

	/**
	 * Get language identifier from file extension.
	 */
	getLanguageFromExtension(ext: string): string {
		const languageMap: Record<string, string> = {
			".ts": "typescript",
			".tsx": "typescript",
			".js": "javascript",
			".jsx": "javascript",
			".py": "python",
			".go": "go",
			".rs": "rust",
			".java": "java",
			".cpp": "cpp",
			".c": "c",
			".rb": "ruby",
			".php": "php",
			".cs": "csharp",
			".swift": "swift",
			".kt": "kotlin",
		}
		return languageMap[ext.toLowerCase()] || "plaintext"
	}

	/**
	 * Read file contents safely.
	 */
	async readFile(filePath: string): Promise<string | null> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			return content
		} catch (error) {
			console.error(`Failed to read file ${filePath}:`, error)
			return null
		}
	}

	/**
	 * Check if a file exists.
	 */
	async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Create an empty diagram structure.
	 */
	createEmptyDiagram(entryPoint: string, description: string, maxDepth: number): CodeFlowDiagram {
		return {
			entryPoint,
			description,
			simpleDescription: description, // Default to description for now if not provided
			detailedAnalysis: [],
			nodes: [],
			edges: [],
			metadata: {
				timestamp: Date.now(),
				maxDepth,
				totalNodes: 0,
			},
		}
	}

	/**
	 * Generate edge ID from source and target.
	 */
	generateEdgeId(sourceId: string, targetId: string): string {
		return `edge-${sourceId}-${targetId}`.replace(/[/:]/g, "_")
	}

	/**
	 * Create an edge between two nodes.
	 */
	createEdge(sourceId: string, targetId: string, label?: string, type?: FlowEdge["type"]): FlowEdge {
		return {
			id: this.generateEdgeId(sourceId, targetId),
			source: sourceId,
			target: targetId,
			label: label || "calls",
			type: type || "call",
			metadata: {
				trigger: label || "calls",
				dataDescription: "Pending analysis",
				dataFormat: "Unknown",
				sampleData: "{ /* pending analysis */ }",
			},
		}
	}

	/**
	 * Serialize a diagram to JSON.
	 */
	serializeDiagram(diagram: CodeFlowDiagram): string {
		return JSON.stringify(diagram, null, 2)
	}

	/**
	 * Deserialize a diagram from JSON.
	 */
	deserializeDiagram(json: string): CodeFlowDiagram {
		return JSON.parse(json) as CodeFlowDiagram
	}

	/**
	 * Detect the framework used in the codebase based on file content.
	 */
	detectFramework(fileContent: string): string | undefined {
		// React detection
		if (fileContent.includes("from 'react'") || fileContent.includes('from "react"')) {
			return "react"
		}

		// Vue detection
		if (fileContent.includes("from 'vue'") || fileContent.includes('from "vue"')) {
			return "vue"
		}

		// Express detection
		if (fileContent.includes("from 'express'") || fileContent.includes('from "express"')) {
			return "express"
		}

		// Next.js detection
		if (fileContent.includes("from 'next'") || fileContent.includes('from "next"')) {
			return "nextjs"
		}

		return undefined
	}

	/**
	 * Update diagram metadata after building nodes.
	 */
	updateDiagramMetadata(diagram: CodeFlowDiagram, language?: string, framework?: string): CodeFlowDiagram {
		return {
			...diagram,
			metadata: {
				...diagram.metadata,
				totalNodes: diagram.nodes.length,
				language,
				framework,
			},
		}
	}
}
