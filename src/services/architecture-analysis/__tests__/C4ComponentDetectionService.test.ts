import { expect } from "chai"
import type { Cluster, FileRecord, RepoInventory } from "@/shared/architecture-visualization/types"
import { C4ComponentDetectionService } from "../C4ComponentDetectionService"

describe("C4ComponentDetectionService", () => {
	let service: C4ComponentDetectionService
	let mockInventory: RepoInventory

	beforeEach(() => {
		service = new C4ComponentDetectionService()
		mockInventory = {
			files: [],
			dependencies: [],
			metadata: {
				timestamp: Date.now(),
				workspaceRoot: "/test",
				fileCount: 0,
				totalLOC: 0,
				analyzedExtensions: [".ts"],
				durationMs: 0,
			},
		}
	})

	describe("detectComponentType", () => {
		it("should detect controller from path", () => {
			const file: FileRecord = {
				path: "src/controllers/UserController.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("controller")
		})

		it("should detect controller from file name", () => {
			const file: FileRecord = {
				path: "src/user.controller.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("controller")
		})

		it("should detect controller from export name", () => {
			const file: FileRecord = {
				path: "src/user.ts",
				size: 100,
				linesOfCode: 50,
				exports: [{ name: "UserController", kind: "class", isDefault: false }],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("controller")
		})

		it("should detect service from path", () => {
			const file: FileRecord = {
				path: "src/services/AuthService.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("service")
		})

		it("should detect repository from prisma import", () => {
			const file: FileRecord = {
				path: "src/data/user-data.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [
					{ source: "@prisma/client", resolvedPath: undefined, importedSymbols: ["PrismaClient"], isTypeOnly: false },
				],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("repository")
		})

		it("should detect component from .tsx file with PascalCase", () => {
			const file: FileRecord = {
				path: "src/Button.tsx",
				size: 100,
				linesOfCode: 50,
				exports: [{ name: "Button", kind: "function", isDefault: true }],
				imports: [{ source: "react", resolvedPath: undefined, importedSymbols: ["FC"], isTypeOnly: false }],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("component")
		})

		it("should detect gateway from axios import", () => {
			const file: FileRecord = {
				path: "src/api/github-client.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [{ source: "axios", resolvedPath: undefined, importedSymbols: ["default"], isTypeOnly: false }],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("gateway")
		})

		it("should detect message_queue from kafka import", () => {
			const file: FileRecord = {
				path: "src/events/message-handler.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [{ source: "kafkajs", resolvedPath: undefined, importedSymbols: ["Kafka"], isTypeOnly: false }],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("message_queue")
		})

		it("should detect cache from redis import", () => {
			const file: FileRecord = {
				path: "src/cache/redis-cache.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [{ source: "redis", resolvedPath: undefined, importedSymbols: ["createClient"], isTypeOnly: false }],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("cache")
		})

		it("should detect middleware from path", () => {
			const file: FileRecord = {
				path: "src/middleware/auth.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("middleware")
		})

		it("should detect database from models path", () => {
			const file: FileRecord = {
				path: "src/models/User.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("database")
		})

		it("should detect config from path", () => {
			const file: FileRecord = {
				path: "src/config/database.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("config")
		})

		it("should detect utility as fallback", () => {
			const file: FileRecord = {
				path: "src/utils/string-helpers.ts",
				size: 100,
				linesOfCode: 50,
				exports: [],
				imports: [],
				language: "typescript",
			}

			const result = service.detectComponentType(file)
			expect(result).to.equal("utility")
		})
	})

	describe("detectTechnologyStack", () => {
		it("should detect TypeScript language", () => {
			const files: FileRecord[] = [
				{
					path: "src/index.ts",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [],
					language: "typescript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.language).to.equal("TypeScript")
		})

		it("should detect JavaScript language", () => {
			const files: FileRecord[] = [
				{
					path: "src/index.js",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [],
					language: "javascript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.language).to.equal("JavaScript")
		})

		it("should detect React framework", () => {
			const files: FileRecord[] = [
				{
					path: "src/App.tsx",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [{ source: "react", resolvedPath: undefined, importedSymbols: ["useState"], isTypeOnly: false }],
					language: "typescript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.framework).to.equal("React")
		})

		it("should detect Express framework", () => {
			const files: FileRecord[] = [
				{
					path: "src/server.ts",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [{ source: "express", resolvedPath: undefined, importedSymbols: ["default"], isTypeOnly: false }],
					language: "typescript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.framework).to.equal("Express")
		})

		it("should detect major libraries", () => {
			const files: FileRecord[] = [
				{
					path: "src/api.ts",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [
						{ source: "axios", resolvedPath: undefined, importedSymbols: ["default"], isTypeOnly: false },
						{ source: "zod", resolvedPath: undefined, importedSymbols: ["z"], isTypeOnly: false },
					],
					language: "typescript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.libraries).to.include("Axios")
			expect(result.libraries).to.include("Zod")
		})

		it("should detect databases", () => {
			const files: FileRecord[] = [
				{
					path: "src/db.ts",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [
						{
							source: "@prisma/client",
							resolvedPath: undefined,
							importedSymbols: ["PrismaClient"],
							isTypeOnly: false,
						},
						{ source: "redis", resolvedPath: undefined, importedSymbols: ["createClient"], isTypeOnly: false },
					],
					language: "typescript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.databases).to.include("Prisma")
		})

		it("should detect messaging systems", () => {
			const files: FileRecord[] = [
				{
					path: "src/queue.ts",
					size: 100,
					linesOfCode: 50,
					exports: [],
					imports: [{ source: "kafkajs", resolvedPath: undefined, importedSymbols: ["Kafka"], isTypeOnly: false }],
					language: "typescript",
				},
			]

			const result = service.detectTechnologyStack(files)
			expect(result.messaging).to.include("Kafka")
		})
	})

	describe("detectRelationshipType", () => {
		it("should detect 'renders' for component to component", () => {
			const fromCluster: Cluster = {
				id: "ui-components",
				label: "UI Components",
				description: "UI components",
				files: [],
				keyFiles: [],
				componentType: "component",
			}

			const toCluster: Cluster = {
				id: "shared-components",
				label: "Shared Components",
				description: "Shared components",
				files: [],
				keyFiles: [],
				componentType: "component",
			}

			const result = service.detectRelationshipType(fromCluster, toCluster)
			expect(result).to.equal("renders")
		})

		it("should detect 'calls' for controller to service", () => {
			const fromCluster: Cluster = {
				id: "api-controllers",
				label: "API Controllers",
				description: "API controllers",
				files: [],
				keyFiles: [],
				componentType: "controller",
			}

			const toCluster: Cluster = {
				id: "business-services",
				label: "Business Services",
				description: "Business services",
				files: [],
				keyFiles: [],
				componentType: "service",
			}

			const result = service.detectRelationshipType(fromCluster, toCluster)
			expect(result).to.equal("calls")
		})

		it("should detect 'reads_from' for repository to database", () => {
			const fromCluster: Cluster = {
				id: "data-repositories",
				label: "Data Repositories",
				description: "Data repositories",
				files: [],
				keyFiles: [],
				componentType: "repository",
			}

			const toCluster: Cluster = {
				id: "database",
				label: "Database",
				description: "Database",
				files: [],
				keyFiles: [],
				componentType: "database",
			}

			const result = service.detectRelationshipType(fromCluster, toCluster, { from: "a.ts", to: "b.ts", count: 2 })
			expect(result).to.equal("reads_from")
		})

		it("should detect 'writes_to' for repository to database with high count", () => {
			const fromCluster: Cluster = {
				id: "data-repositories",
				label: "Data Repositories",
				description: "Data repositories",
				files: [],
				keyFiles: [],
				componentType: "repository",
			}

			const toCluster: Cluster = {
				id: "database",
				label: "Database",
				description: "Database",
				files: [],
				keyFiles: [],
				componentType: "database",
			}

			const result = service.detectRelationshipType(fromCluster, toCluster, { from: "a.ts", to: "b.ts", count: 10 })
			expect(result).to.equal("writes_to")
		})

		it("should detect 'publishes_to' for service to message_queue", () => {
			const fromCluster: Cluster = {
				id: "services",
				label: "Services",
				description: "Services",
				files: [],
				keyFiles: [],
				componentType: "service",
			}

			const toCluster: Cluster = {
				id: "queue",
				label: "Message Queue",
				description: "Message queue",
				files: [],
				keyFiles: [],
				componentType: "message_queue",
			}

			const result = service.detectRelationshipType(fromCluster, toCluster)
			expect(result).to.equal("publishes_to")
		})
	})

	describe("detectProtocol", () => {
		it("should detect gRPC from imports", () => {
			const inventory: RepoInventory = {
				files: [
					{
						path: "src/api.ts",
						size: 100,
						linesOfCode: 50,
						exports: [],
						imports: [
							{ source: "@grpc/grpc-js", resolvedPath: undefined, importedSymbols: ["Client"], isTypeOnly: false },
						],
						language: "typescript",
					},
				],
				dependencies: [],
				metadata: {
					timestamp: Date.now(),
					workspaceRoot: "/test",
					fileCount: 1,
					totalLOC: 50,
					analyzedExtensions: [".ts"],
					durationMs: 0,
				},
			}

			const fromCluster: Cluster = {
				id: "api",
				label: "API",
				description: "API",
				files: ["src/api.ts"],
				keyFiles: [],
				componentType: "service",
			}

			const toCluster: Cluster = {
				id: "external",
				label: "External",
				description: "External",
				files: [],
				keyFiles: [],
				componentType: "external_system",
			}

			const result = service.detectProtocol(
				fromCluster,
				toCluster,
				[{ from: "src/api.ts", to: "external", count: 5 }],
				inventory,
			)
			expect(result).to.equal("gRPC")
		})

		it("should detect SQL for database component", () => {
			const fromCluster: Cluster = {
				id: "repos",
				label: "Repositories",
				description: "Repositories",
				files: [],
				keyFiles: [],
				componentType: "repository",
			}

			const toCluster: Cluster = {
				id: "db",
				label: "Database",
				description: "Database",
				files: [],
				keyFiles: [],
				componentType: "database",
			}

			const result = service.detectProtocol(fromCluster, toCluster, [], mockInventory)
			expect(result).to.equal("SQL")
		})

		it("should detect Redis for cache component", () => {
			const fromCluster: Cluster = {
				id: "service",
				label: "Service",
				description: "Service",
				files: [],
				keyFiles: [],
				componentType: "service",
			}

			const toCluster: Cluster = {
				id: "cache",
				label: "Cache",
				description: "Cache",
				files: [],
				keyFiles: [],
				componentType: "cache",
			}

			const result = service.detectProtocol(fromCluster, toCluster, [], mockInventory)
			expect(result).to.equal("Redis")
		})

		it("should detect HTTP for controller", () => {
			const fromCluster: Cluster = {
				id: "controller",
				label: "Controller",
				description: "Controller",
				files: [],
				keyFiles: [],
				componentType: "controller",
			}

			const toCluster: Cluster = {
				id: "service",
				label: "Service",
				description: "Service",
				files: [],
				keyFiles: [],
				componentType: "service",
			}

			const result = service.detectProtocol(fromCluster, toCluster, [], mockInventory)
			expect(result).to.equal("HTTP")
		})

		it("should detect Internal as default", () => {
			const fromCluster: Cluster = {
				id: "util",
				label: "Utility",
				description: "Utility",
				files: [],
				keyFiles: [],
				componentType: "utility",
			}

			const toCluster: Cluster = {
				id: "service",
				label: "Service",
				description: "Service",
				files: [],
				keyFiles: [],
				componentType: "service",
			}

			const result = service.detectProtocol(fromCluster, toCluster, [], mockInventory)
			expect(result).to.equal("Internal")
		})
	})
})
