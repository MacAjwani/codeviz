import * as fs from "fs/promises"
import * as path from "path"
import type { CodeFlowDiagram, DiagramInfo, VisualizationSettings } from "@/shared/code-visualization/types"

const DEFAULT_STORAGE_LOCATION = ".vscode/codeviz"
const DIAGRAMS_DIR = "diagrams"
const SETTINGS_FILE = "settings.json"

const DEFAULT_SETTINGS: VisualizationSettings = {
	storageLocation: DEFAULT_STORAGE_LOCATION,
	autoLayout: true,
	defaultLayoutDirection: "TB",
}

/**
 * Service for persisting and retrieving code flow diagrams and settings.
 */
export class DiagramStorageService {
	private workspaceRoot: string
	private settings: VisualizationSettings

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
		this.settings = { ...DEFAULT_SETTINGS }
	}

	/**
	 * Get the base storage directory path.
	 */
	private getStorageDir(): string {
		return path.join(this.workspaceRoot, this.settings.storageLocation)
	}

	/**
	 * Get the diagrams directory path.
	 */
	private getDiagramsDir(): string {
		return path.join(this.getStorageDir(), DIAGRAMS_DIR)
	}

	/**
	 * Get the settings file path.
	 */
	private getSettingsPath(): string {
		return path.join(this.getStorageDir(), SETTINGS_FILE)
	}

	/**
	 * Ensure the storage directories exist.
	 */
	private async ensureStorageDir(): Promise<void> {
		const diagramsDir = this.getDiagramsDir()
		await fs.mkdir(diagramsDir, { recursive: true })
	}

	/**
	 * Generate a unique diagram ID based on entry point and timestamp.
	 */
	generateDiagramId(entryPoint: string): string {
		const timestamp = Date.now()
		const sanitized = entryPoint
			.replace(/[^a-zA-Z0-9]/g, "_")
			.replace(/_+/g, "_")
			.substring(0, 50)
		return `${sanitized}_${timestamp}`
	}

	/**
	 * Get the file path for a diagram.
	 */
	private getDiagramPath(diagramId: string): string {
		return path.join(this.getDiagramsDir(), `${diagramId}.json`)
	}

	/**
	 * Save a diagram to disk.
	 * @returns The diagram ID
	 */
	async saveDiagram(diagram: CodeFlowDiagram): Promise<string> {
		await this.ensureStorageDir()

		const diagramId = this.generateDiagramId(diagram.entryPoint)
		const diagramPath = this.getDiagramPath(diagramId)

		// Add the ID to the diagram for reference
		const diagramWithId = {
			...diagram,
			id: diagramId,
		}

		await fs.writeFile(diagramPath, JSON.stringify(diagramWithId, null, 2), "utf-8")

		return diagramId
	}

	/**
	 * Load a diagram by ID.
	 */
	async loadDiagram(diagramId: string): Promise<CodeFlowDiagram | null> {
		const diagramPath = this.getDiagramPath(diagramId)

		try {
			const content = await fs.readFile(diagramPath, "utf-8")
			return JSON.parse(content) as CodeFlowDiagram
		} catch (error) {
			console.error(`Failed to load diagram ${diagramId}:`, error)
			return null
		}
	}

	/**
	 * List all saved diagrams.
	 */
	async listDiagrams(): Promise<DiagramInfo[]> {
		const diagramsDir = this.getDiagramsDir()

		try {
			const files = await fs.readdir(diagramsDir)
			const diagrams: DiagramInfo[] = []

			for (const file of files) {
				if (!file.endsWith(".json")) {
					continue
				}

				try {
					const filePath = path.join(diagramsDir, file)
					const content = await fs.readFile(filePath, "utf-8")
					const diagram = JSON.parse(content) as CodeFlowDiagram & { id?: string }

					diagrams.push({
						id: diagram.id || file.replace(".json", ""),
						entryPoint: diagram.entryPoint,
						description: diagram.description,
						createdAt: diagram.metadata.timestamp,
						nodeCount: diagram.nodes.length,
					})
				} catch (parseError) {
					console.error(`Failed to parse diagram file ${file}:`, parseError)
				}
			}

			// Sort by creation time, newest first
			diagrams.sort((a, b) => b.createdAt - a.createdAt)

			return diagrams
		} catch (error) {
			// Directory might not exist yet
			return []
		}
	}

	/**
	 * Delete a diagram by ID.
	 */
	async deleteDiagram(diagramId: string): Promise<boolean> {
		const diagramPath = this.getDiagramPath(diagramId)

		try {
			await fs.unlink(diagramPath)
			return true
		} catch (error) {
			console.error(`Failed to delete diagram ${diagramId}:`, error)
			return false
		}
	}

	/**
	 * Load visualization settings.
	 */
	async loadSettings(): Promise<VisualizationSettings> {
		const settingsPath = this.getSettingsPath()

		try {
			const content = await fs.readFile(settingsPath, "utf-8")
			const loadedSettings = JSON.parse(content) as Partial<VisualizationSettings>

			// Merge with defaults to ensure all fields are present
			this.settings = {
				...DEFAULT_SETTINGS,
				...loadedSettings,
			}
		} catch {
			// Settings file doesn't exist, use defaults
			this.settings = { ...DEFAULT_SETTINGS }
		}

		return this.settings
	}

	/**
	 * Save visualization settings.
	 */
	async saveSettings(settings: VisualizationSettings): Promise<void> {
		await this.ensureStorageDir()

		const settingsPath = this.getSettingsPath()
		this.settings = settings

		await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8")
	}

	/**
	 * Get current settings (in memory).
	 */
	getSettings(): VisualizationSettings {
		return { ...this.settings }
	}

	/**
	 * Update specific settings.
	 */
	async updateSettings(updates: Partial<VisualizationSettings>): Promise<VisualizationSettings> {
		const newSettings: VisualizationSettings = {
			...this.settings,
			...updates,
		}

		await this.saveSettings(newSettings)
		return newSettings
	}
}
