/**
 * Zod validation schemas for architecture visualization types.
 *
 * These schemas provide runtime validation to ensure:
 * 1. LLM output matches expected structure
 * 2. File paths in clusters exist in inventory
 * 3. Edge references point to valid clusters
 */

import { z } from "zod"

// ============================================================================
// RepoInventory Schemas
// ============================================================================

export const ExportedSymbolSchema = z.object({
	name: z.string().min(1),
	kind: z.enum(["function", "class", "interface", "type", "const", "enum", "variable"]),
	isDefault: z.boolean(),
})

export const ImportRecordSchema = z.object({
	source: z.string().min(1),
	resolvedPath: z.string().optional(),
	importedSymbols: z.array(z.string()),
	isTypeOnly: z.boolean(),
})

export const FileRecordSchema = z.object({
	path: z.string().min(1),
	size: z.number().nonnegative(),
	linesOfCode: z.number().nonnegative(),
	exports: z.array(ExportedSymbolSchema),
	imports: z.array(ImportRecordSchema),
	language: z.enum(["typescript", "javascript"]),
})

export const DependencyEdgeSchema = z.object({
	from: z.string().min(1),
	to: z.string().min(1),
	count: z.number().positive(),
	importedTypes: z.array(z.string()),
})

export const InventoryMetadataSchema = z.object({
	timestamp: z.number().positive(),
	workspaceRoot: z.string().min(1),
	fileCount: z.number().nonnegative(),
	totalLOC: z.number().nonnegative(),
	analyzedExtensions: z.array(z.string()),
	durationMs: z.number().nonnegative(),
})

export const RepoInventorySchema = z.object({
	files: z.array(FileRecordSchema),
	dependencies: z.array(DependencyEdgeSchema),
	metadata: InventoryMetadataSchema,
})

// ============================================================================
// ClusterGraph Schemas
// ============================================================================

// C4 Model Enums
export const C4ComponentTypeSchema = z.enum([
	"controller",
	"service",
	"repository",
	"component",
	"gateway",
	"database",
	"external_system",
	"message_queue",
	"cache",
	"middleware",
	"utility",
	"config",
])

export const C4RelationshipTypeSchema = z.enum([
	"uses",
	"calls",
	"renders",
	"reads_from",
	"writes_to",
	"publishes_to",
	"subscribes_to",
])

export const C4ProtocolSchema = z.enum(["HTTP", "gRPC", "SQL", "Redis", "REST", "GraphQL", "WebSocket", "AMQP", "Internal"])

export const TechnologyStackSchema = z.object({
	language: z.string().optional(),
	framework: z.string().optional(),
	libraries: z.array(z.string()).optional(),
	databases: z.array(z.string()).optional(),
	messaging: z.array(z.string()).optional(),
})

export const ClusterSchema = z.object({
	id: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Cluster ID must be lowercase-with-hyphens"),
	label: z.string().min(1),
	description: z.string().min(1),
	files: z.array(z.string().min(1)).min(1), // At least one file per cluster
	keyFiles: z.array(z.string().min(1)),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional(), // Hex color
	layer: z.enum(["presentation", "business", "data", "infrastructure"]).optional(),
	// C4 Model Fields (Version 2)
	version: z.number().optional().default(2),
	componentType: C4ComponentTypeSchema.optional(),
	technology: TechnologyStackSchema.optional(),
	responsibilities: z.array(z.string()).optional(),
})

export const ClusterEdgeSchema = z.object({
	id: z.string().min(1),
	source: z.string().min(1),
	target: z.string().min(1),
	weight: z.number().positive(),
	label: z.string().min(1),
	topDependencies: z.array(
		z.object({
			from: z.string().min(1),
			to: z.string().min(1),
			count: z.number().positive(),
		}),
	),
	// C4 Model Fields (Version 2)
	relationshipType: C4RelationshipTypeSchema.optional(),
	protocol: C4ProtocolSchema.optional(),
	description: z.string().optional(),
})

export const FilteringDefaultsSchema = z.object({
	minEdgeWeight: z.number().nonnegative().default(2),
	collapsedClusters: z.array(z.string()).default([]),
	visibleLayers: z.array(z.string()).default([]),
})

export const ClusterGraphMetadataSchema = z.object({
	timestamp: z.number().positive(),
	clusterCount: z.number().positive(), // Just counts clusters, no enforcement
	sourceInventoryHash: z.string().min(1),
	schemaVersion: z.number().default(2).optional(),
	c4Level: z.literal("C3").optional(),
})

export const ClusterGraphSchema = z.object({
	id: z.string().min(1).optional(), // Added programmatically after LLM generation
	clusters: z.array(ClusterSchema).min(5).max(12), // Enforce 5-12 clusters
	clusterEdges: z.array(ClusterEdgeSchema),
	filteringDefaults: FilteringDefaultsSchema,
	metadata: ClusterGraphMetadataSchema.optional(), // Added programmatically after LLM generation
})

// ============================================================================
// Validation Functions with Cross-References
// ============================================================================

/**
 * Validates that a ClusterGraph is consistent with its RepoInventory.
 *
 * Checks:
 * - All cluster.files[] paths exist in inventory
 * - All cluster.keyFiles[] are subset of cluster.files[]
 * - All clusterEdges source/target reference valid cluster IDs
 *
 * @returns Validation result with detailed error messages
 */
export function validateClusterGraphAgainstInventory(
	clusterGraph: unknown,
	inventory: unknown,
): { valid: boolean; errors: string[] } {
	const errors: string[] = []

	// First validate basic schema
	const graphResult = ClusterGraphSchema.safeParse(clusterGraph)
	if (!graphResult.success) {
		return {
			valid: false,
			errors: graphResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
		}
	}

	const inventoryResult = RepoInventorySchema.safeParse(inventory)
	if (!inventoryResult.success) {
		return {
			valid: false,
			errors: inventoryResult.error.errors.map((e) => `Inventory ${e.path.join(".")}: ${e.message}`),
		}
	}

	const graph = graphResult.data
	const inv = inventoryResult.data

	// Build sets for fast lookup
	const inventoryPaths = new Set(inv.files.map((f) => f.path))
	const clusterIds = new Set(graph.clusters.map((c) => c.id))

	// Validate cluster file paths
	for (const cluster of graph.clusters) {
		for (const filePath of cluster.files) {
			if (!inventoryPaths.has(filePath)) {
				errors.push(`Cluster "${cluster.id}" references non-existent file: ${filePath}`)
			}
		}

		// Validate keyFiles are subset of files
		for (const keyFile of cluster.keyFiles) {
			if (!cluster.files.includes(keyFile)) {
				errors.push(`Cluster "${cluster.id}" keyFile "${keyFile}" not in files array`)
			}
		}
	}

	// Validate cluster edges reference valid clusters
	for (const edge of graph.clusterEdges) {
		if (!clusterIds.has(edge.source)) {
			errors.push(`Edge "${edge.id}" references unknown source cluster: ${edge.source}`)
		}
		if (!clusterIds.has(edge.target)) {
			errors.push(`Edge "${edge.id}" references unknown target cluster: ${edge.target}`)
		}

		// Validate topDependencies files exist
		for (const dep of edge.topDependencies) {
			if (!inventoryPaths.has(dep.from)) {
				errors.push(`Edge "${edge.id}" topDependency references non-existent file: ${dep.from}`)
			}
			if (!inventoryPaths.has(dep.to)) {
				errors.push(`Edge "${edge.id}" topDependency references non-existent file: ${dep.to}`)
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

/**
 * Generate hash of inventory for cache invalidation.
 */
export function hashInventory(inventory: unknown): string {
	const inv = RepoInventorySchema.parse(inventory)
	const hashInput = JSON.stringify({
		fileCount: inv.metadata.fileCount,
		totalLOC: inv.metadata.totalLOC,
		workspaceRoot: inv.metadata.workspaceRoot,
		// Include first 10 file paths as sample
		samplePaths: inv.files.slice(0, 10).map((f) => f.path),
	})
	// Simple hash (in production, use crypto.createHash)
	return Buffer.from(hashInput).toString("base64").slice(0, 16)
}
