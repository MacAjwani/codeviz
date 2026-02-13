import type { Boolean, EmptyRequest } from "@shared/proto/cline/common"
import { StringRequest } from "@shared/proto/cline/common"
import { useEffect } from "react"
import AccountView from "./components/account/AccountView"
import HistoryView from "./components/history/HistoryView"
import McpView from "./components/mcp/configuration/McpConfigurationView"
import OnboardingView from "./components/onboarding/OnboardingView"
import { SplitView } from "./components/SplitView"
import SettingsView from "./components/settings/SettingsView"
import { VisualizationView } from "./components/visualization"
import WelcomeView from "./components/welcome/WelcomeView"
import { useClineAuth } from "./context/ClineAuthContext"
import { useExtensionState } from "./context/ExtensionStateContext"
import { Providers } from "./Providers"
import { FileServiceClient, UiServiceClient } from "./services/grpc-client"

const AppContent = () => {
	const {
		didHydrateState,
		showWelcome,
		shouldShowAnnouncement,
		showMcp,
		mcpTab,
		showSettings,
		settingsTargetSection,
		showHistory,
		showAccount,
		showAnnouncement,
		showVisualization,
		currentDiagramId,
		openArchitectureDiagramId,
		openArchitectureTraceId,
		onboardingModels,
		setShowAnnouncement,
		setShouldShowAnnouncement,
		closeMcpView,
		navigateToHistory,
		hideSettings,
		hideHistory,
		hideAccount,
		hideAnnouncement,
		hideVisualization,
	} = useExtensionState()

	const { clineUser, organizations, activeOrganization } = useClineAuth()

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)

			// Use the gRPC client instead of direct WebviewMessage
			UiServiceClient.onDidShowAnnouncement({} as EmptyRequest)
				.then((response: Boolean) => {
					setShouldShowAnnouncement(response.value)
				})
				.catch((error) => {
					console.error("Failed to acknowledge announcement:", error)
				})
		}
	}, [shouldShowAnnouncement, setShouldShowAnnouncement, setShowAnnouncement])

	if (!didHydrateState) {
		return null
	}

	if (showWelcome) {
		return onboardingModels ? <OnboardingView onboardingModels={onboardingModels} /> : <WelcomeView />
	}

	return (
		<div className="flex h-screen w-full flex-col">
			{showSettings && <SettingsView onDone={hideSettings} targetSection={settingsTargetSection} />}
			{showHistory && <HistoryView onDone={hideHistory} />}
			{showMcp && <McpView initialTab={mcpTab} onDone={closeMcpView} />}
			{showAccount && (
				<AccountView
					activeOrganization={activeOrganization}
					clineUser={clineUser}
					onDone={hideAccount}
					organizations={organizations}
				/>
			)}
			{showVisualization && currentDiagramId && (
				<VisualizationView
					diagramId={currentDiagramId}
					onClose={hideVisualization}
					onOpenFile={(filePath, lineNumber) => {
						// Open file in editor - format with line number if provided
						const filePathWithLine = lineNumber ? `${filePath}:${lineNumber}` : filePath
						FileServiceClient.openFile(StringRequest.create({ value: filePathWithLine }))
							.then(() => {
								// Optional: hide visualization after opening file
								// hideVisualization()
							})
							.catch((error: Error) => {
								console.error("Failed to open file:", error)
							})
					}}
				/>
			)}
			{/* Main split view: Architecture diagram (left) + Chat (right) */}
			{/* Do not conditionally load - expensive and has state we don't want to lose */}
			<SplitView
				hideAnnouncement={hideAnnouncement}
				isHidden={showSettings || showHistory || showMcp || showAccount || showVisualization}
				openDiagramId={openArchitectureDiagramId}
				openTraceId={openArchitectureTraceId}
				showAnnouncement={showAnnouncement}
				showHistoryView={navigateToHistory}
			/>
		</div>
	)
}

const App = () => {
	return (
		<Providers>
			<AppContent />
		</Providers>
	)
}

export default App
