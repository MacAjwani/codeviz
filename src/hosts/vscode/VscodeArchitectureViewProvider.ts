import * as path from "path"
import * as vscode from "vscode"
import type { Controller } from "@/core/controller"
import { handleGrpcRequest, handleGrpcRequestCancel } from "@/core/controller/grpc-handler"
import { HostProvider } from "@/hosts/host-provider"
import type { ExtensionMessage } from "@/shared/ExtensionMessage"
import { WebviewMessage } from "@/shared/WebviewMessage"

/**
 * Webview provider for architecture diagram visualization.
 * Displays interactive clustered component diagrams with React Flow.
 *
 * Supports both:
 * - Sidebar view (legacy, narrow panel)
 * - Full-screen editor panel (recommended, for full diagram + chat layout)
 */
export class VscodeArchitectureViewProvider implements vscode.WebviewViewProvider {
	public static readonly VIEW_ID = "cline.architectureView"
	private static currentPanel?: vscode.WebviewPanel

	private webview?: vscode.WebviewView
	private disposables: vscode.Disposable[] = []

	constructor(
		private readonly controller: Controller,
		private readonly context: vscode.ExtensionContext,
	) {}

	/**
	 * Create or show a full-screen architecture diagram panel in the editor area.
	 * This is the preferred way to view architecture diagrams (75% diagram, 25% chat).
	 */
	public static async createOrShowPanel(controller: Controller, context: vscode.ExtensionContext): Promise<void> {
		const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

		// If panel already exists, reveal it
		if (VscodeArchitectureViewProvider.currentPanel) {
			VscodeArchitectureViewProvider.currentPanel.reveal(columnToShowIn)
			return
		}

		// Create new panel
		const panel = vscode.window.createWebviewPanel(
			"clineArchitectureDiagram",
			"Architecture Diagram",
			columnToShowIn || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.file(HostProvider.get().extensionFsPath)],
			},
		)

		VscodeArchitectureViewProvider.currentPanel = panel

		// Set HTML content
		const provider = new VscodeArchitectureViewProvider(controller, context)
		panel.webview.html = await provider.getHtmlContent(panel.webview)

		// Set up message listener
		panel.webview.onDidReceiveMessage((message) => provider.handleWebviewMessage(message), null, provider.disposables)

		// Reset when panel is closed
		panel.onDidDispose(
			() => {
				VscodeArchitectureViewProvider.currentPanel = undefined
				provider.dispose()
			},
			null,
			provider.disposables,
		)

		HostProvider.get().logToChannel("Architecture diagram panel opened")
	}

	public async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
		this.webview = webviewView

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(HostProvider.get().extensionFsPath)],
		}

		webviewView.webview.html = await this.getHtmlContent(webviewView.webview)

		// Set up message listener for gRPC communication
		this.setWebviewMessageListener(webviewView.webview)

		// Listen for when the view is disposed
		webviewView.onDidDispose(
			() => {
				this.dispose()
			},
			null,
			this.disposables,
		)

		HostProvider.get().logToChannel("Architecture view resolved")
	}

	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			(message) => {
				this.handleWebviewMessage(message)
			},
			null,
			this.disposables,
		)
	}

	private async handleWebviewMessage(message: WebviewMessage) {
		const postMessageToWebview = (response: ExtensionMessage): Thenable<boolean | undefined> => {
			if (this.webview) {
				return this.webview.webview.postMessage(response)
			}
			if (VscodeArchitectureViewProvider.currentPanel) {
				return VscodeArchitectureViewProvider.currentPanel.webview.postMessage(response)
			}
			return Promise.resolve(undefined)
		}

		console.log(
			"[VscodeArchitectureViewProvider] Received message type:",
			message.type,
			"Full message:",
			JSON.stringify(message),
		)

		switch (message.type) {
			case "grpc_request": {
				if (message.grpc_request) {
					await handleGrpcRequest(this.controller, postMessageToWebview, message.grpc_request)
				}
				break
			}
			case "grpc_request_cancel": {
				if (message.grpc_request_cancel) {
					await handleGrpcRequestCancel(postMessageToWebview, message.grpc_request_cancel)
				}
				break
			}
			case "openFile": {
				const filePath = message.filePath
				const lineNumber = message.lineNumber
				console.log("[VscodeArchitectureViewProvider] Opening file:", filePath, lineNumber ? `at line ${lineNumber}` : "")
				if (filePath) {
					try {
						const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
						if (workspaceFolder) {
							const absolutePath = path.isAbsolute(filePath)
								? filePath
								: path.join(workspaceFolder.uri.fsPath, filePath)
							const fileUri = vscode.Uri.file(absolutePath)

							// Open document with optional line selection
							if (lineNumber !== undefined && lineNumber > 0) {
								const document = await vscode.workspace.openTextDocument(fileUri)
								const line = Math.max(0, lineNumber - 1) // Convert to 0-based index
								const position = new vscode.Position(line, 0)
								const selection = new vscode.Selection(position, position)

								await vscode.window.showTextDocument(document, {
									selection,
									viewColumn: vscode.ViewColumn.One,
								})

								// Reveal the line in the center of the viewport
								const editor = vscode.window.activeTextEditor
								if (editor) {
									editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter)
								}
							} else {
								await vscode.window.showTextDocument(fileUri)
							}
							console.log("[VscodeArchitectureViewProvider] Successfully opened file:", filePath)
						} else {
							console.error("[VscodeArchitectureViewProvider] No workspace folder found")
						}
					} catch (error) {
						console.error("[VscodeArchitectureViewProvider] Failed to open file:", error)
						vscode.window.showErrorMessage(`Failed to open file: ${filePath}`)
					}
				}
				break
			}
			default: {
				console.error("Received unhandled WebviewMessage type:", JSON.stringify(message))
			}
		}
	}

	private async getHtmlContent(webview: vscode.Webview): Promise<string> {
		const extensionPath = HostProvider.get().extensionFsPath
		const webviewPath = path.join(extensionPath, "webview-ui", "build")

		// For development mode, we could add HMR support later
		// For now, just serve the production build

		const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, "assets", "index.js")))
		const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, "assets", "index.css")))

		const nonce = this.getNonce()
		const cspSource = webview.cspSource

		return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};">
		<link rel="stylesheet" type="text/css" href="${styleUri}">
		<title>Architecture Diagram</title>
	</head>
	<body>
		<div id="root" data-view-type="architecture"></div>
		<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
	</body>
</html>`
	}

	private getNonce(): string {
		let text = ""
		const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length))
		}
		return text
	}

	public dispose() {
		while (this.disposables.length) {
			const disposable = this.disposables.pop()
			if (disposable) {
				disposable.dispose()
			}
		}
	}
}
