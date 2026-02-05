/**
 * LLM-powered clustering service for architecture diagrams.
 * Converts RepoInventory → ClusterGraph with validation and retry logic.
 */

import crypto from "crypto"
import type { ApiHandler } from "@/core/api"
import { ClusterGraphSchema } from "@/shared/architecture-visualization/schemas"
import type { Cluster, ClusterGraph, RepoInventory } from "@/shared/architecture-visualization/types"

export class ArchitectureClusteringService {
	/**
	 * Main orchestration: prompt LLM → validate → retry on failure
	 */
	async clusterArchitecture(inventory: RepoInventory, api: ApiHandler, userHint?: string): Promise<ClusterGraph> {
		let attempts = 0
		let lastError = ""
		const maxAttempts = 3

		while (attempts < maxAttempts) {
			try {
				// Build clustering prompt
				const prompt = this.buildClusteringPrompt(inventory, userHint, lastError)

				console.log(`[ArchitectureClustering] Attempt ${attempts + 1}/${maxAttempts}`)

				// Call LLM
				const messages = [{ role: "user" as const, content: prompt }]
				const systemPrompt =
					"You are an expert software architect. Analyze codebases and create logical component groupings."

				const stream = api.createMessage(systemPrompt, messages, [])

				let responseText = ""
				for await (const chunk of stream) {
					if (chunk.type === "text") {
						responseText += chunk.text
					}
				}

				console.log(`[ArchitectureClustering] LLM response length: ${responseText.length} chars`)

				// Extract JSON from response (handle markdown code blocks)
				const jsonMatch = responseText.match(/\{[\s\S]*\}/)
				if (!jsonMatch) {
					throw new Error("No JSON object found in LLM response")
				}

				const clusterGraphData = JSON.parse(jsonMatch[0])

				// Validate with Zod schema
				const validationResult = ClusterGraphSchema.safeParse(clusterGraphData)
				if (!validationResult.success) {
					const errors = validationResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
					throw new Error(`Schema validation failed: ${errors.join(", ")}`)
				}

				const clusterGraph = validationResult.data

				// Additional validation: check file paths exist in inventory
				const validation = this.validateClusterGraph(clusterGraph, inventory)
				if (!validation.valid) {
					throw new Error(`Cluster validation failed: ${validation.errors.join(", ")}`)
				}

				// Success! Add metadata
				clusterGraph.id = this.generateClusterGraphId()
				clusterGraph.metadata = {
					timestamp: Date.now(),
					clusterCount: clusterGraph.clusters.length,
					sourceInventoryHash: this.hashInventory(inventory),
				}

				console.log(`[ArchitectureClustering] Successfully generated ${clusterGraph.clusters.length} clusters`)
				return clusterGraph
			} catch (error) {
				attempts++
				const errorMsg = error instanceof Error ? error.message : String(error)
				console.error(`[ArchitectureClustering] Attempt ${attempts} failed:`, errorMsg)

				if (attempts >= maxAttempts) {
					throw new Error(`LLM clustering failed after ${maxAttempts} attempts. Last error: ${errorMsg}`)
				}

				// Provide feedback for retry
				lastError = `\n\nPREVIOUS ATTEMPT FAILED:\n${errorMsg}\n\nPlease fix the issues and output valid JSON.`
			}
		}

		throw new Error("Clustering failed unexpectedly")
	}

	/**
	 * Build clustering prompt with strict constraints
	 */
	private buildClusteringPrompt(inventory: RepoInventory, userHint?: string, errorFeedback?: string): string {
		// For large inventories, truncate to avoid token limits
		const maxFiles = 500
		const files = inventory.files.slice(0, maxFiles)
		const truncated = inventory.files.length > maxFiles

		const inventorySummary = {
			files: files.map((f) => ({
				path: f.path,
				linesOfCode: f.linesOfCode,
				exports: f.exports.map((e) => e.name).slice(0, 5), // Top 5 exports only
				imports: f.imports
					.filter((i) => !i.isTypeOnly) // Exclude type-only imports
					.map((i) => i.source)
					.slice(0, 5), // Top 5 runtime imports only
			})),
			dependencies: inventory.dependencies
				.filter((d) => files.some((f) => f.path === d.from))
				.filter((d) => !d.importedTypes.includes("type")) // Exclude type-only dependencies
				.slice(0, 1000), // Limit to 1000 edges
		}

		return `You are analyzing a codebase to create an architecture diagram.

CRITICAL CONSTRAINTS:
1. You MUST ONLY reference file paths from the provided inventory below
2. Do NOT invent, guess, or hallucinate file paths
3. All cluster.files arrays MUST contain ONLY paths from the inventory
4. You MUST cite evidence: list 3-5 "keyFiles" that justify each cluster
5. Output MUST be valid JSON matching the schema exactly
6. DO NOT create clusters for configuration files (*.config.*, tsconfig.json, etc.)
7. DO NOT create clusters for files that only define types (interfaces, type aliases)
8. IGNORE type-only imports when analyzing dependencies - focus on actual code dependencies

TASK:
Group files into 5-12 logical clusters based on their responsibility and RUNTIME dependencies.
Each cluster represents a major architectural component that executes code at runtime.
Exclude files that are only used for configuration or type definitions.

OUTPUT JSON SCHEMA (output ONLY these fields, no metadata or id at top level):
{
  "clusters": [
    {
      "id": "lowercase-with-hyphens",
      "label": "Human-Readable Label",
      "description": "1-2 sentence summary of this cluster's responsibility",
      "files": ["path/to/file1.ts", "path/to/file2.ts"],
      "keyFiles": ["path/to/file1.ts"],
      "layer": "presentation | business | data | infrastructure"
    }
  ],
  "clusterEdges": [
    {
      "id": "cluster1-to-cluster2",
      "source": "cluster1-id",
      "target": "cluster2-id",
      "weight": 12,
      "label": "API calls",
      "topDependencies": [
        { "from": "auth/AuthService.ts", "to": "api/userRoutes.ts", "count": 5 }
      ]
    }
  ],
  "filteringDefaults": {
    "minEdgeWeight": 2,
    "collapsedClusters": [],
    "visibleLayers": []
  }
}

IMPORTANT: Do NOT include "id" or "metadata" fields at the root level. Only output the three fields shown above.

CLUSTERING STRATEGY:
- Group by responsibility: authentication, API routes, UI components, data access, utilities
- Consider file paths: src/auth/* likely belong together
- Use RUNTIME dependencies: files with many cross-imports should cluster together
- Ignore type-only imports (marked with isTypeOnly: true)
- Skip files that only export types/interfaces (no executable code)
- Skip configuration files entirely
- Aim for 5-12 clusters (not too granular, not too coarse)
- Prefer balanced cluster sizes (avoid 1 file vs 100 files in one cluster)
- Make clusters independently understandable and meaningful
- Focus on components that represent actual data flow and execution

INVENTORY${truncated ? ` (showing first ${maxFiles} of ${inventory.files.length} files)` : ""}:
${JSON.stringify(inventorySummary, null, 2)}

${userHint ? `USER HINT:\n${userHint}\n\n` : ""}${errorFeedback || ""}
OUTPUT (JSON only, no markdown code fences):
`
	}

	/**
	 * Validate cluster graph against inventory
	 */
	private validateClusterGraph(graph: ClusterGraph, inventory: RepoInventory): { valid: boolean; errors: string[] } {
		const errors: string[] = []
		const inventoryPaths = new Set(inventory.files.map((f) => f.path))
		const clusterIds = new Set(graph.clusters.map((c) => c.id))

		// Validate clusters
		for (const cluster of graph.clusters) {
			// Check all files exist in inventory
			for (const filePath of cluster.files) {
				if (!inventoryPaths.has(filePath)) {
					errors.push(`Cluster "${cluster.id}" references non-existent file: ${filePath}`)
				}
			}

			// Check keyFiles are subset of files
			for (const keyFile of cluster.keyFiles) {
				if (!cluster.files.includes(keyFile)) {
					errors.push(`Cluster "${cluster.id}" keyFile "${keyFile}" not in files array`)
				}
			}

			// Check ID format
			if (!/^[a-z0-9-]+$/.test(cluster.id)) {
				errors.push(`Cluster ID "${cluster.id}" must be lowercase-with-hyphens`)
			}

			// Check cluster has at least 1 file
			if (cluster.files.length === 0) {
				errors.push(`Cluster "${cluster.id}" has no files`)
			}
		}

		// Validate edges
		for (const edge of graph.clusterEdges) {
			if (!clusterIds.has(edge.source)) {
				errors.push(`Edge "${edge.id}" references unknown source cluster: ${edge.source}`)
			}
			if (!clusterIds.has(edge.target)) {
				errors.push(`Edge "${edge.id}" references unknown target cluster: ${edge.target}`)
			}
		}

		return { valid: errors.length === 0, errors }
	}

	/**
	 * Generate unique ID for cluster graph
	 */
	private generateClusterGraphId(): string {
		const timestamp = Date.now()
		const random = Math.random().toString(36).substring(2, 8)
		return `arch-${timestamp}-${random}`
	}

	/**
	 * Hash inventory for cache invalidation
	 */
	private hashInventory(inventory: RepoInventory): string {
		const data = JSON.stringify({
			fileCount: inventory.files.length,
			totalLOC: inventory.metadata.totalLOC,
			timestamp: inventory.metadata.timestamp,
		})
		return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16)
	}

	/**
	 * Generate step-by-step data flow explanation
	 */
	async generateDataFlowExplanation(clusterGraph: ClusterGraph, inventory: RepoInventory, api: ApiHandler): Promise<string> {
		// Organize clusters by layer
		const clustersByLayer = new Map<string, Cluster[]>()
		for (const cluster of clusterGraph.clusters) {
			const layer = cluster.layer || "unknown"
			if (!clustersByLayer.has(layer)) {
				clustersByLayer.set(layer, [])
			}
			clustersByLayer.get(layer)!.push(cluster)
		}

		// Build cluster details for context
		const clusterDetails = clusterGraph.clusters.map((c) => ({
			id: c.id,
			label: c.label,
			description: c.description,
			layer: c.layer,
			fileCount: c.files.length,
			keyFiles: c.keyFiles.slice(0, 3), // Top 3 key files
		}))

		// Get execution path edges (layer-to-layer only)
		const executionEdges = clusterGraph.clusterEdges.filter((edge) => {
			const sourceCluster = clusterGraph.clusters.find((c) => c.id === edge.source)
			const targetCluster = clusterGraph.clusters.find((c) => c.id === edge.target)
			return sourceCluster?.layer !== targetCluster?.layer
		})

		const prompt = `You are explaining the data flow in a software architecture.

ARCHITECTURE OVERVIEW:
${JSON.stringify(clusterDetails, null, 2)}

EXECUTION PATH EDGES (how data flows between layers):
${executionEdges
	.map((e) => {
		const source = clusterGraph.clusters.find((c) => c.id === e.source)
		const target = clusterGraph.clusters.find((c) => c.id === e.target)
		return `- ${source?.label} (${source?.layer}) → ${target?.label} (${target?.layer}): ${e.label}`
	})
	.join("\n")}

TASK:
Generate a clear, step-by-step explanation of how data flows through this architecture.

Start from the presentation layer (where user interaction begins) and trace the execution path down through business logic, data access, and infrastructure layers.

For each step, explain:
1. Which component handles this step
2. What happens at this step
3. How it connects to the next step

Format as numbered steps. Be concrete and specific. Reference the actual component names and edge labels provided above.

Example format:
1. **[Component Name]** - User interaction begins here. The [component] handles [specific action] and then [what it does next].
2. **[Component Name]** - Receives [what] from previous step and [processes it by doing X]. Then [passes to next component].
...

Keep it clear and sequential. Focus on the critical path of execution.
`

		const messages = [{ role: "user" as const, content: prompt }]
		const stream = api.createMessage(
			"You are a technical writer explaining software architecture clearly and concisely.",
			messages,
			[],
		)

		let explanation = ""
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				explanation += chunk.text
			}
		}

		return explanation.trim()
	}

	/**
	 * Generate cluster summary with evidence (for node click)
	 */
	async generateClusterSummary(
		cluster: Cluster,
		inventory: RepoInventory,
		clusterGraph: ClusterGraph,
		api: ApiHandler,
	): Promise<string> {
		const incomingEdges = clusterGraph.clusterEdges.filter((e) => e.target === cluster.id)
		const outgoingEdges = clusterGraph.clusterEdges.filter((e) => e.source === cluster.id)

		const keyFileDetails = cluster.keyFiles.map((filePath) => {
			const fileRecord = inventory.files.find((f) => f.path === filePath)
			return {
				path: filePath,
				exports: fileRecord?.exports.map((e) => e.name).join(", ") || "none",
				linesOfCode: fileRecord?.linesOfCode || 0,
			}
		})

		const prompt = `You are generating a summary for an architecture cluster.

CLUSTER DETAILS:
Name: ${cluster.label}
Description: ${cluster.description}
Files: ${cluster.files.length} total

KEY FILES (evidence):
${keyFileDetails.map((f) => `- ${f.path} (${f.linesOfCode} LOC)\n  Exports: ${f.exports}`).join("\n")}

DEPENDENCIES:
Incoming (${incomingEdges.length} clusters depend on this):
${incomingEdges
	.map((e) => {
		const sourceCluster = clusterGraph.clusters.find((c) => c.id === e.source)
		return `- ${sourceCluster?.label}: ${e.weight} dependencies`
	})
	.join("\n")}

Outgoing (this cluster depends on ${outgoingEdges.length} others):
${outgoingEdges
	.map((e) => {
		const targetCluster = clusterGraph.clusters.find((c) => c.id === e.target)
		return `- ${targetCluster?.label}: ${e.weight} dependencies`
	})
	.join("\n")}

TASK:
Generate a concise 2-3 paragraph summary explaining:
1. The cluster's role in the system architecture
2. Key files and what they do (cite specific filenames)
3. How it interacts with other clusters (upstream/downstream dependencies)

Keep it concise and cite specific files as evidence.
`

		const messages = [{ role: "user" as const, content: prompt }]
		const stream = api.createMessage("You are a technical writer explaining software architecture.", messages, [])

		let summary = ""
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				summary += chunk.text
			}
		}

		return summary.trim()
	}
}
