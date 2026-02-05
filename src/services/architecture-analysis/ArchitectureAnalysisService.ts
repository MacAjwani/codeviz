/**
 * Service for analyzing workspace architecture.
 *
 * Scans TypeScript/JavaScript files, extracts imports/exports using ts-morph,
 * and builds a complete dependency graph of the codebase.
 *
 * Performance target: < 30 seconds for 1000+ files
 */

import * as fs from "fs/promises"
import { globby } from "globby"
import * as path from "path"
import { Project, SourceFile, SyntaxKind } from "ts-morph"
import type {
	DependencyEdge,
	ExportedSymbol,
	FileRecord,
	ImportRecord,
	RepoInventory,
} from "@/shared/architecture-visualization/types"

export interface ScanOptions {
	extensions?: string[] // File extensions to include (default: [".ts", ".tsx", ".js", ".jsx"])
	excludePatterns?: string[] // Glob patterns to exclude
	maxFiles?: number // Maximum files to analyze (for testing)
	batchSize?: number // Files to process in parallel (default: 50)
}

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"]
const DEFAULT_EXCLUDE_PATTERNS = [
	"**/node_modules/**",
	"**/dist/**",
	"**/build/**",
	"**/out/**",
	"**/.git/**",
	"**/coverage/**",
	"**/.next/**",
	"**/.vscode/**",
	"**/*.test.ts",
	"**/*.test.tsx",
	"**/*.test.js",
	"**/*.test.jsx",
	"**/*.spec.ts",
	"**/*.spec.tsx",
	"**/*.spec.js",
	"**/*.spec.jsx",
	"**/*.d.ts", // Skip type declaration files
	"**/__tests__/**",
	"**/__mocks__/**",
	// Configuration files
	"**/*.config.ts",
	"**/*.config.js",
	"**/*.config.mjs",
	"**/*.config.cjs",
	"**/tsconfig.json",
	"**/jsconfig.json",
	"**/package.json",
	"**/package-lock.json",
	"**/.eslintrc.*",
	"**/.prettierrc.*",
	"**/vite.config.*",
	"**/webpack.config.*",
	"**/rollup.config.*",
	"**/jest.config.*",
	"**/vitest.config.*",
	"**/tailwind.config.*",
	"**/postcss.config.*",
]

export class ArchitectureAnalysisService {
	private tsProject: Project | null = null

	constructor() {}

	/**
	 * Main entry point: analyze workspace and generate complete inventory.
	 */
	async generateInventory(
		workspaceRoot: string,
		options: ScanOptions = {},
		progressCallback?: (current: number, total: number) => void,
	): Promise<RepoInventory> {
		const startTime = Date.now()

		console.log(`[ArchitectureAnalysis] Starting analysis of ${workspaceRoot}`)

		// Step 1: Scan for eligible files
		const files = await this.scanWorkspace(workspaceRoot, options)
		console.log(`[ArchitectureAnalysis] Found ${files.length} files to analyze`)

		if (files.length === 0) {
			throw new Error("No TypeScript/JavaScript files found in workspace")
		}

		// Step 2: Initialize ts-morph project
		this.tsProject = new Project({
			skipAddingFilesFromTsConfig: true,
			skipFileDependencyResolution: true,
			skipLoadingLibFiles: true,
		})

		// Step 3: Analyze files in batches
		const batchSize = options.batchSize || 50
		const fileRecords: FileRecord[] = []
		const allDependencies: { from: string; to: string; count: number; types: Set<string> }[] = []

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, Math.min(i + batchSize, files.length))
			const batchResults = await Promise.all(batch.map((filePath) => this.analyzeFile(filePath, workspaceRoot)))

			for (const result of batchResults) {
				if (result.record) {
					fileRecords.push(result.record)

					// Build dependencies from this file's imports
					if (result.record.imports) {
						for (const imp of result.record.imports) {
							if (imp.resolvedPath) {
								const targetRelPath = path.relative(workspaceRoot, imp.resolvedPath)
								allDependencies.push({
									from: result.record.path,
									to: targetRelPath,
									count: 1,
									types: new Set(imp.importedSymbols),
								})
							}
						}
					}
				}
			}

			// Report progress
			if (progressCallback) {
				progressCallback(Math.min(i + batchSize, files.length), files.length)
			}
		}

		// Step 4: Aggregate dependencies (merge duplicates)
		const dependencyEdges = this.aggregateDependencies(allDependencies)

		const durationMs = Date.now() - startTime
		console.log(
			`[ArchitectureAnalysis] Analysis complete: ${fileRecords.length} files, ${dependencyEdges.length} dependencies, ${durationMs}ms`,
		)

		return {
			files: fileRecords,
			dependencies: dependencyEdges,
			metadata: {
				timestamp: Date.now(),
				workspaceRoot,
				fileCount: fileRecords.length,
				totalLOC: fileRecords.reduce((sum, f) => sum + f.linesOfCode, 0),
				analyzedExtensions: options.extensions || DEFAULT_EXTENSIONS,
				durationMs,
			},
		}
	}

	/**
	 * Scan workspace for TypeScript/JavaScript files.
	 */
	async scanWorkspace(workspaceRoot: string, options: ScanOptions = {}): Promise<string[]> {
		const extensions = options.extensions || DEFAULT_EXTENSIONS
		const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS

		const patterns = extensions.map((ext) => `**/*${ext}`)

		const files = await globby(patterns, {
			cwd: workspaceRoot,
			absolute: true,
			ignore: excludePatterns,
			gitignore: true,
		})

		// Apply maxFiles limit if specified
		return options.maxFiles ? files.slice(0, options.maxFiles) : files
	}

	/**
	 * Analyze a single file: extract imports, exports, and metadata.
	 */
	private async analyzeFile(absolutePath: string, workspaceRoot: string): Promise<{ record: FileRecord | null }> {
		try {
			// Get relative path
			const relativePath = path.relative(workspaceRoot, absolutePath)

			// Check file size (skip files > 5MB - likely generated/bundled)
			const stats = await fs.stat(absolutePath)
			if (stats.size > 5 * 1024 * 1024) {
				console.warn(`[ArchitectureAnalysis] Skipping large file: ${relativePath} (${stats.size} bytes)`)
				return { record: null }
			}

			// Add source file to ts-morph project
			const sourceFile = this.tsProject!.addSourceFileAtPath(absolutePath)

			// Extract exports
			const exports = this.extractExports(sourceFile)

			// Extract imports
			const imports = this.extractImports(sourceFile, absolutePath, workspaceRoot)

			// Determine language
			const ext = path.extname(absolutePath)
			const language = ext === ".ts" || ext === ".tsx" ? "typescript" : "javascript"

			// Count lines of code
			const linesOfCode = sourceFile.getEndLineNumber()

			const record: FileRecord = {
				path: relativePath,
				size: stats.size,
				linesOfCode,
				exports,
				imports,
				language,
			}

			return { record }
		} catch (error) {
			console.warn(
				`[ArchitectureAnalysis] Failed to parse ${absolutePath}:`,
				error instanceof Error ? error.message : error,
			)
			return { record: null }
		}
	}

	/**
	 * Extract exported symbols from a source file.
	 */
	private extractExports(sourceFile: SourceFile): ExportedSymbol[] {
		const exports: ExportedSymbol[] = []

		// Get all exported declarations
		const exportedDeclarations = sourceFile.getExportedDeclarations()

		exportedDeclarations.forEach((declarations, name) => {
			// Handle default exports
			const isDefault = name === "default"

			declarations.forEach((decl) => {
				const kind = this.getSymbolKind(decl.getKind())
				if (kind) {
					exports.push({
						name: isDefault ? "default" : name,
						kind,
						isDefault,
					})
				}
			})
		})

		return exports
	}

	/**
	 * Extract import statements from a source file.
	 */
	private extractImports(sourceFile: SourceFile, absolutePath: string, workspaceRoot: string): ImportRecord[] {
		const imports: ImportRecord[] = []

		const importDeclarations = sourceFile.getImportDeclarations()

		for (const imp of importDeclarations) {
			const moduleSpecifier = imp.getModuleSpecifierValue()
			const isTypeOnly = imp.isTypeOnly()

			// Extract imported symbols
			const importedSymbols: string[] = []
			const namedImports = imp.getNamedImports()
			for (const ni of namedImports) {
				importedSymbols.push(ni.getName())
			}

			// Check for default import
			const defaultImport = imp.getDefaultImport()
			if (defaultImport) {
				importedSymbols.push("default")
			}

			// Resolve import path (if local)
			const resolvedPath = this.resolveImportPath(moduleSpecifier, absolutePath, workspaceRoot)

			imports.push({
				source: moduleSpecifier,
				resolvedPath,
				importedSymbols,
				isTypeOnly,
			})
		}

		return imports
	}

	/**
	 * Resolve an import module specifier to an absolute file path (if local).
	 */
	private resolveImportPath(moduleSpecifier: string, fromFile: string, workspaceRoot: string): string | undefined {
		// Skip external packages (don't start with . or /)
		if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) {
			return undefined
		}

		const fromDir = path.dirname(fromFile)
		const resolvedPath = path.resolve(fromDir, moduleSpecifier)

		// Try adding extensions if file doesn't exist
		const extensions = [".ts", ".tsx", ".js", ".jsx", ".d.ts"]

		try {
			// Check if path exists as-is or with extensions
			for (const ext of ["", ...extensions]) {
				const testPath = resolvedPath + ext
				try {
					if (require("fs").existsSync(testPath) && require("fs").statSync(testPath).isFile()) {
						return testPath
					}
				} catch {
					// Continue to next extension
				}
			}

			// Check for index files
			for (const ext of extensions) {
				const indexPath = path.join(resolvedPath, `index${ext}`)
				try {
					if (require("fs").existsSync(indexPath) && require("fs").statSync(indexPath).isFile()) {
						return indexPath
					}
				} catch {
					// Continue to next extension
				}
			}
		} catch (error) {
			// Resolution failed, return undefined
		}

		return undefined
	}

	/**
	 * Aggregate dependencies: merge duplicate edges and count occurrences.
	 */
	private aggregateDependencies(
		dependencies: { from: string; to: string; count: number; types: Set<string> }[],
	): DependencyEdge[] {
		const aggregated = new Map<string, DependencyEdge>()

		for (const dep of dependencies) {
			const key = `${dep.from}:::${dep.to}`

			if (aggregated.has(key)) {
				const existing = aggregated.get(key)!
				existing.count += dep.count
				// Merge imported types
				dep.types.forEach((t) => {
					if (!existing.importedTypes.includes(t)) {
						existing.importedTypes.push(t)
					}
				})
			} else {
				aggregated.set(key, {
					from: dep.from,
					to: dep.to,
					count: dep.count,
					importedTypes: Array.from(dep.types),
				})
			}
		}

		return Array.from(aggregated.values())
	}

	/**
	 * Get symbol kind from ts-morph SyntaxKind.
	 */
	private getSymbolKind(syntaxKind: SyntaxKind): ExportedSymbol["kind"] | null {
		switch (syntaxKind) {
			case SyntaxKind.FunctionDeclaration:
			case SyntaxKind.FunctionExpression:
			case SyntaxKind.ArrowFunction:
				return "function"
			case SyntaxKind.ClassDeclaration:
				return "class"
			case SyntaxKind.InterfaceDeclaration:
				return "interface"
			case SyntaxKind.TypeAliasDeclaration:
				return "type"
			case SyntaxKind.VariableDeclaration:
				return "const"
			case SyntaxKind.EnumDeclaration:
				return "enum"
			default:
				return "variable"
		}
	}
}
