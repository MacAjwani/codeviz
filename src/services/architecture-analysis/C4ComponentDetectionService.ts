/**
 * Pattern-based detection service for C4 component types.
 * Uses file paths, names, and imports to classify components.
 */

import type {
	C4ComponentType,
	C4Protocol,
	C4RelationshipType,
	Cluster,
	FileRecord,
	RepoInventory,
	TechnologyStack,
} from "@/shared/architecture-visualization/types"

export class C4ComponentDetectionService {
	/**
	 * Detect component type from file characteristics.
	 * Uses priority-based pattern matching: controllers > services > repositories > etc.
	 */
	detectComponentType(file: FileRecord): C4ComponentType {
		const path = file.path.toLowerCase()
		const pathOriginal = file.path // Keep original for case-sensitive checks
		const fileName = path.split("/").pop() || ""
		const fileNameOriginal = pathOriginal.split("/").pop() || ""

		// Check exports for component type hints
		const exportNames = file.exports.map((e) => e.name)
		const hasControllerExport = exportNames.some((name) => name.endsWith("Controller"))
		const hasServiceExport = exportNames.some((name) => name.endsWith("Service"))
		const hasRepositoryExport = exportNames.some((name) => name.endsWith("Repository"))

		// Import sources (for pattern matching)
		const importSources = file.imports.map((i) => i.source.toLowerCase())

		// Priority 1: Controllers (HTTP request handlers)
		// BUT exclude if it's clearly a client/gateway file
		const isClientFile = fileName.includes("client.") || fileName.includes("gateway.")
		if (
			!isClientFile &&
			(path.includes("/controllers/") ||
				path.includes("/routes/") ||
				path.includes("/api/") ||
				fileName.includes("controller.") ||
				fileName.includes("route.") ||
				hasControllerExport)
		) {
			return "controller"
		}

		// Priority 2: Middleware
		if (
			path.includes("/middleware/") ||
			fileName.includes("middleware.") ||
			exportNames.some((name) => name.toLowerCase().includes("middleware"))
		) {
			return "middleware"
		}

		// Priority 3: Services (business logic)
		if (path.includes("/services/") || fileName.includes("service.") || fileName.includes("manager.") || hasServiceExport) {
			return "service"
		}

		// Priority 4: Repositories (data access)
		if (
			path.includes("/repositories/") ||
			path.includes("/data-access/") ||
			path.includes("/dao/") ||
			fileName.includes("repository.") ||
			fileName.includes("dao.") ||
			hasRepositoryExport ||
			importSources.some((src) => src.includes("prisma") || src.includes("typeorm") || src.includes("mongoose"))
		) {
			return "repository"
		}

		// Priority 5: Database (ORM models, schemas)
		if (
			path.includes("/models/") ||
			path.includes("/entities/") ||
			path.includes("/schemas/") ||
			fileName.includes("model.") ||
			fileName.includes("entity.") ||
			fileName.includes("schema.") ||
			importSources.some((src) => src.includes("@prisma/client") || src.includes("sequelize"))
		) {
			return "database"
		}

		// Priority 6: UI Components (React, Vue, etc.)
		if (path.includes("/components/") || path.includes("/views/") || path.includes("/pages/")) {
			return "component"
		}

		// Check for React/Vue component files (PascalCase .tsx/.jsx files)
		// Use original filename for case-sensitive check
		const fileNameWithoutExt = fileNameOriginal.replace(/\.(tsx|jsx|ts|js)$/, "")
		if (
			(fileName.endsWith(".tsx") || fileName.endsWith(".jsx")) &&
			file.exports.some((e) => e.kind === "function" || e.kind === "const") &&
			/^[A-Z]/.test(fileNameWithoutExt)
		) {
			return "component"
		}

		// Priority 7: Gateways (external API clients)
		if (
			path.includes("/gateways/") ||
			path.includes("/clients/") ||
			fileName.includes("client.") ||
			fileName.includes("gateway.")
		) {
			return "gateway"
		}

		// Check for external API client libraries (but not in controller/routes context)
		if (
			!path.includes("/controllers/") &&
			!path.includes("/routes/") &&
			!path.includes("/api/") &&
			importSources.some((src) => src.includes("axios") || src.includes("@octokit"))
		) {
			return "gateway"
		}

		// Priority 8: Message Queue
		if (
			path.includes("/queue/") ||
			path.includes("/events/") ||
			path.includes("/jobs/") ||
			fileName.includes("queue.") ||
			fileName.includes("worker.") ||
			importSources.some(
				(src) => src.includes("bull") || src.includes("kafka") || src.includes("rabbitmq") || src.includes("amqp"),
			)
		) {
			return "message_queue"
		}

		// Priority 9: Cache
		if (
			path.includes("/cache/") ||
			fileName.includes("cache.") ||
			importSources.some((src) => src.includes("redis") || src.includes("memcached") || src.includes("node-cache"))
		) {
			return "cache"
		}

		// Priority 10: External System integrations
		if (path.includes("/third-party/") || path.includes("/external/")) {
			return "external_system"
		}

		// Priority 11: Configuration
		if (
			path.includes("/config/") ||
			fileName.includes("config.") ||
			fileName.includes("settings.") ||
			fileName === "constants.ts" ||
			fileName === "env.ts"
		) {
			return "config"
		}

		// Priority 12: Utilities (fallback)
		if (
			path.includes("/utils/") ||
			path.includes("/helpers/") ||
			path.includes("/lib/") ||
			fileName.includes("util.") ||
			fileName.includes("helper.")
		) {
			return "utility"
		}

		// Default: utility
		return "utility"
	}

	/**
	 * Detect technology stack from file imports and patterns.
	 * Aggregates across multiple files for accuracy.
	 */
	detectTechnologyStack(files: FileRecord[]): TechnologyStack {
		const stack: TechnologyStack = {
			libraries: [],
			databases: [],
			messaging: [],
		}

		// Aggregate all imports
		const allImports = files.flatMap((f) => f.imports.map((i) => i.source.toLowerCase()))

		// Detect language (assume TypeScript if any .ts files)
		const hasTypeScript = files.some((f) => f.language === "typescript")
		stack.language = hasTypeScript ? "TypeScript" : "JavaScript"

		// Detect frameworks (priority order)
		const frameworks = [
			{ pattern: "next", name: "Next.js" },
			{ pattern: "@nestjs", name: "NestJS" },
			{ pattern: "express", name: "Express" },
			{ pattern: "react", name: "React" },
			{ pattern: "vue", name: "Vue" },
			{ pattern: "angular", name: "Angular" },
			{ pattern: "fastify", name: "Fastify" },
			{ pattern: "koa", name: "Koa" },
		]

		for (const fw of frameworks) {
			if (allImports.some((imp) => imp.includes(fw.pattern))) {
				stack.framework = fw.name
				break
			}
		}

		// Detect major libraries (top 8)
		const libraryPatterns = [
			{ pattern: "axios", name: "Axios" },
			{ pattern: "zod", name: "Zod" },
			{ pattern: "rxjs", name: "RxJS" },
			{ pattern: "lodash", name: "Lodash" },
			{ pattern: "date-fns", name: "date-fns" },
			{ pattern: "uuid", name: "uuid" },
			{ pattern: "joi", name: "Joi" },
			{ pattern: "yup", name: "Yup" },
		]

		for (const lib of libraryPatterns) {
			if (allImports.some((imp) => imp.includes(lib.pattern))) {
				stack.libraries!.push(lib.name)
				if (stack.libraries!.length >= 5) break
			}
		}

		// Detect databases
		const dbPatterns = [
			{ pattern: "@prisma/client", name: "Prisma" },
			{ pattern: "prisma", name: "Prisma" },
			{ pattern: "typeorm", name: "TypeORM" },
			{ pattern: "mongoose", name: "MongoDB" },
			{ pattern: "sequelize", name: "Sequelize" },
			{ pattern: "pg", name: "PostgreSQL" },
			{ pattern: "mysql", name: "MySQL" },
			{ pattern: "sqlite", name: "SQLite" },
		]

		for (const db of dbPatterns) {
			if (allImports.some((imp) => imp.includes(db.pattern))) {
				if (!stack.databases!.includes(db.name)) {
					stack.databases!.push(db.name)
				}
			}
		}

		// Detect messaging systems
		const messagingPatterns = [
			{ pattern: "kafka", name: "Kafka" },
			{ pattern: "rabbitmq", name: "RabbitMQ" },
			{ pattern: "amqp", name: "AMQP" },
			{ pattern: "bull", name: "Bull" },
			{ pattern: "redis", name: "Redis" },
		]

		for (const msg of messagingPatterns) {
			if (allImports.some((imp) => imp.includes(msg.pattern))) {
				if (!stack.messaging!.includes(msg.name)) {
					stack.messaging!.push(msg.name)
				}
			}
		}

		// Clean up empty arrays
		if (stack.libraries!.length === 0) delete stack.libraries
		if (stack.databases!.length === 0) delete stack.databases
		if (stack.messaging!.length === 0) delete stack.messaging

		return stack
	}

	/**
	 * Infer relationship type based on component types and edge characteristics.
	 */
	detectRelationshipType(
		fromCluster: Cluster,
		toCluster: Cluster,
		topDependency?: { from: string; to: string; count: number },
	): C4RelationshipType {
		const fromType = fromCluster.componentType
		const toType = toCluster.componentType

		if (!fromType || !toType) {
			return "uses"
		}

		// UI component rendering
		if (fromType === "component" && toType === "component") {
			return "renders"
		}

		// Controller to service
		if (fromType === "controller" && toType === "service") {
			return "calls"
		}

		// Service to service
		if (fromType === "service" && toType === "service") {
			return "calls"
		}

		// Service to repository
		if (fromType === "service" && toType === "repository") {
			return "calls"
		}

		// Repository to database (read/write heuristic: assume write if high count)
		if (fromType === "repository" && toType === "database") {
			return topDependency && topDependency.count > 5 ? "writes_to" : "reads_from"
		}

		// Any to message queue
		if (toType === "message_queue") {
			return "publishes_to"
		}

		// Message queue to any
		if (fromType === "message_queue") {
			return "subscribes_to"
		}

		// Gateway/external system
		if (fromType === "gateway" || toType === "external_system") {
			return "calls"
		}

		// Default
		return "uses"
	}

	/**
	 * Generate a descriptive edge label based on component types and relationship.
	 * Used as fallback when LLM doesn't provide a description.
	 * Keeps descriptions to 8 words or fewer.
	 */
	generateEdgeDescription(fromCluster: Cluster, toCluster: Cluster, relationshipType: C4RelationshipType): string {
		const fromType = fromCluster.componentType
		const toType = toCluster.componentType

		// Generate concise, business-focused descriptions (≤8 words)
		if (fromType === "controller" && toType === "service") {
			return "Delegates business operations"
		}

		if (fromType === "service" && toType === "repository") {
			return "Requests data operations"
		}

		if (fromType === "repository" && toType === "database") {
			if (relationshipType === "writes_to") {
				return "Persists data"
			}
			return "Queries data"
		}

		if (fromType === "service" && toType === "gateway") {
			return "Calls external APIs"
		}

		if (fromType === "gateway" && toType === "external_system") {
			return "Integrates with external services"
		}

		if (toType === "message_queue") {
			return "Publishes events"
		}

		if (fromType === "message_queue") {
			return "Receives events"
		}

		if (toType === "cache") {
			return "Caches data"
		}

		if (fromType === "component" && toType === "component") {
			return "Renders child components"
		}

		if (fromType === "component" && toType === "service") {
			return "Invokes operations"
		}

		if (fromType === "middleware" && toType === "service") {
			return "Forwards requests"
		}

		// Generic descriptions based on relationship type (≤8 words)
		switch (relationshipType) {
			case "calls":
				return "Invokes operations"
			case "uses":
				return "Uses functionality"
			case "renders":
				return "Displays content"
			case "reads_from":
				return "Reads data"
			case "writes_to":
				return "Writes data"
			case "publishes_to":
				return "Sends messages"
			case "subscribes_to":
				return "Receives messages"
			default:
				return "Interacts with"
		}
	}

	/**
	 * Detect communication protocol based on component types and imports.
	 */
	detectProtocol(
		fromCluster: Cluster,
		toCluster: Cluster,
		topDependencies: { from: string; to: string; count: number }[],
		inventory: RepoInventory,
	): C4Protocol {
		const fromType = fromCluster.componentType
		const toType = toCluster.componentType

		// Check imports from top dependencies
		const dependencyFiles = topDependencies
			.map((dep) => inventory.files.find((f) => f.path === dep.from))
			.filter(Boolean) as FileRecord[]

		const allImports = dependencyFiles.flatMap((f) => f.imports.map((i) => i.source.toLowerCase()))

		// Protocol detection from imports
		if (allImports.some((imp) => imp.includes("grpc") || imp.includes("@grpc"))) {
			return "gRPC"
		}

		if (allImports.some((imp) => imp.includes("graphql") || imp.includes("apollo"))) {
			return "GraphQL"
		}

		if (allImports.some((imp) => imp.includes("socket.io") || imp.includes("ws") || imp.includes("websocket"))) {
			return "WebSocket"
		}

		// Protocol detection from component types
		if (toType === "database") {
			return "SQL"
		}

		if (toType === "cache") {
			return "Redis"
		}

		if (toType === "message_queue") {
			return "AMQP"
		}

		if (fromType === "controller" || toType === "gateway") {
			return "HTTP"
		}

		if (fromType === "gateway" || toType === "external_system") {
			return "REST"
		}

		// Default: internal in-process call
		return "Internal"
	}
}
