# Code Visualization Implementation Plan for Cline

## Executive Summary

This plan details the implementation of an LLM-powered code flow visualization feature integrated into Cline. Users can ask natural language questions like "Help me understand the login button flow" and receive interactive React Flow diagrams showing data flow through the codebase with detailed explanations.

**Key Design Decisions:**
- Built directly into Cline (not a separate extension)
- LLM-based tracing (not static analysis) for flexibility
- React Flow for interactive diagrams
- Diagram storage in workspace `.vscode/codeviz/` directory
- gRPC communication following Cline's architectural patterns
- Separate panel view alongside chat (similar to browser/diff views)

---

## 1. Tool Implementation: `trace_code_flow`

### 1.1 Tool Definition

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/prompts/system-prompt/tools/trace_code_flow.ts`

```typescript
import { ModelFamily } from "@/shared/prompts"
import { ClineDefaultTool } from "@/shared/tools"
import type { ClineToolSpec } from "../spec"

const id = ClineDefaultTool.TRACE_CODE_FLOW

const GENERIC: ClineToolSpec = {
    variant: ModelFamily.GENERIC,
    id,
    name: "trace_code_flow",
    description:
        "Trace code execution flow through a codebase starting from a specific entry point (component, function, API endpoint, etc.). Use this to help users understand how code flows through the system. The tool performs intelligent code analysis to follow data flow, function calls, and component hierarchies. Returns a structured representation of the code path that will be visualized as an interactive diagram.",
    parameters: [
        {
            name: "entry_point",
            required: true,
            instruction:
                "The starting point for the trace. Can be a file path with optional function/component name (e.g., 'src/components/LoginButton.tsx:handleClick', 'api/auth.ts:login', or just 'src/App.tsx')",
            usage: "src/components/LoginButton.tsx:handleClick",
        },
        {
            name: "description",
            required: true,
            instruction:
                "A clear description of what the user wants to understand. This helps guide the tracing to focus on relevant code paths.",
            usage: "What happens when the user clicks the login button",
        },
        {
            name: "max_depth",
            required: false,
            instruction:
                "Maximum depth to trace (number of levels). Defaults to 10. Use lower values (3-5) for high-level overviews, higher values (10-15) for detailed traces.",
            usage: "8",
        },
    ],
}

const NEXT_GEN: ClineToolSpec = {
    ...GENERIC,
    variant: ModelFamily.NEXT_GEN,
    description:
        "Trace code execution flow through a codebase to understand data flow and component interactions. Analyzes code starting from an entry point and follows the execution path through functions, components, API calls, and external dependencies. Generates a structured flow representation optimized for visualization.",
}

export const trace_code_flow_variants = [GENERIC, NEXT_GEN]
```

**Add to enum:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/tools.ts`
```typescript
export enum ClineDefaultTool {
    // ... existing tools
    TRACE_CODE_FLOW = "trace_code_flow",
}

export const READ_ONLY_TOOLS = [
    // ... existing tools
    ClineDefaultTool.TRACE_CODE_FLOW,
] as const
```

**Register:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/prompts/system-prompt/tools/init.ts`
```typescript
import { trace_code_flow_variants } from "./trace_code_flow"

export function registerClineToolSets(): void {
    const allToolVariants = [
        // ... existing variants
        ...trace_code_flow_variants,
    ]
    // ... registration logic
}
```

**Add to variant configs:** Update each variant config file:
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/prompts/system-prompt/variants/generic/config.ts`
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/prompts/system-prompt/variants/next-gen/config.ts`
- And all other variant configs

Add `ClineDefaultTool.TRACE_CODE_FLOW` to the `.tools()` array.

### 1.2 Tool Handler Implementation

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/task/tools/handlers/TraceCodeFlowToolHandler.ts`

```typescript
import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@core/prompts/responses"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { ToolValidator } from "../ToolValidator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

export class TraceCodeFlowToolHandler implements IFullyManagedTool {
    readonly name = ClineDefaultTool.TRACE_CODE_FLOW

    constructor(private validator: ToolValidator) {}

    getDescription(block: ToolUse): string {
        return `[${block.name} for '${block.params.entry_point}']`
    }

    async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
        const partialMessage = JSON.stringify({
            status: "tracing",
            entryPoint: uiHelpers.removeClosingTag(block, "entry_point", block.params.entry_point),
            description: block.params.description,
        })

        await uiHelpers.say("trace_code_flow", partialMessage, undefined, undefined, block.partial)
    }

    async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
        // Validate parameters
        const entryPointValidation = this.validator.assertRequiredParams(block, "entry_point")
        if (!entryPointValidation.ok) {
            config.taskState.consecutiveMistakeCount++
            return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_point")
        }

        const descriptionValidation = this.validator.assertRequiredParams(block, "description")
        if (!descriptionValidation.ok) {
            config.taskState.consecutiveMistakeCount++
            return await config.callbacks.sayAndCreateMissingParamError(this.name, "description")
        }

        config.taskState.consecutiveMistakeCount = 0

        const entryPoint: string = block.params.entry_point
        const description: string = block.params.description
        const maxDepth: number = parseInt(block.params.max_depth ?? "10", 10)

        // Initiate tracing status message
        await config.callbacks.say("trace_code_flow", JSON.stringify({
            status: "analyzing",
            entryPoint,
            description,
        }))

        try {
            // Use LLM to trace the code flow
            const traceResult = await this.performLLMTrace(config, entryPoint, description, maxDepth)

            // Save diagram to disk
            const diagramPath = await this.saveDiagram(config, traceResult)

            // Update status
            await config.callbacks.say("trace_code_flow", JSON.stringify({
                status: "complete",
                entryPoint,
                description,
                diagramPath,
                nodeCount: traceResult.nodes.length,
            }))

            return formatResponse.toolResult(
                `Code flow trace completed successfully.\n\n` +
                `Entry Point: ${entryPoint}\n` +
                `Description: ${description}\n` +
                `Nodes Traced: ${traceResult.nodes.length}\n` +
                `Diagram saved to: ${diagramPath}\n\n` +
                `The interactive diagram is now available in the Code Visualization panel.`
            )
        } catch (error) {
            await config.callbacks.say("error", `Failed to trace code flow: ${error.message}`)
            return formatResponse.toolError(`Code flow tracing failed: ${error.message}`)
        }
    }

    private async performLLMTrace(
        config: TaskConfig,
        entryPoint: string,
        description: string,
        maxDepth: number
    ): Promise<CodeFlowDiagram> {
        // Implementation: Multi-step LLM-based tracing
        // 1. Parse entry point to extract file path and symbol name
        // 2. Read the entry point file using existing read_file tool
        // 3. Use LLM to identify the starting function/component
        // 4. Iteratively trace through the code:
        //    - For each node, ask LLM to analyze:
        //      a. Component/function responsibility
        //      b. Input data (props, parameters, state)
        //      c. Output data (return values, side effects)
        //      d. Next steps in the flow (function calls, component renders)
        //    - Use search_files and read_file to gather context
        //    - Build the flow graph incrementally
        // 5. Stop when:
        //    - Max depth reached
        //    - External boundary hit (API call, database, browser API)
        //    - No more flow to trace (terminal node)
        // 6. Generate explanations for each node using LLM
        
        // Return structured diagram data
        return {
            entryPoint,
            description,
            nodes: [], // Array of FlowNode objects
            edges: [], // Array of FlowEdge objects
            metadata: {
                timestamp: Date.now(),
                maxDepth,
                totalNodes: 0,
            }
        }
    }

    private async saveDiagram(config: TaskConfig, diagram: CodeFlowDiagram): Promise<string> {
        // Save to .vscode/codeviz/ in workspace
        // Use StateManager pattern with atomic writes
        // Return path relative to workspace
        return ".vscode/codeviz/flow-TIMESTAMP.json"
    }
}
```

**Register handler:** In `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/task/tools/tool-registrations.ts` (or wherever handlers are registered):

```typescript
import { TraceCodeFlowToolHandler } from "./handlers/TraceCodeFlowToolHandler"

coordinator.register(new TraceCodeFlowToolHandler(validator))
```

---

## 2. Data Structures & Types

### 2.1 Diagram Data Schema

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/code-visualization/types.ts`

```typescript
export interface CodeFlowDiagram {
    entryPoint: string
    description: string
    nodes: FlowNode[]
    edges: FlowEdge[]
    metadata: DiagramMetadata
}

export interface FlowNode {
    id: string // unique identifier
    type: "component" | "function" | "api" | "database" | "external" | "entry"
    label: string // display name (e.g., "LoginButton", "handleSubmit")
    filePath: string // relative path to file
    lineNumber?: number // line number in file
    
    // 6 pieces of information
    componentResponsibility: string // What does this component/function do?
    inputDescription: string // What data comes in?
    outputDescription: string // What data goes out?
    fileResponsibility: string // What is the purpose of this file?
    codeSegmentDescription: string // Explanation of relevant code
    codeSegment: string // Actual code snippet (for link to source)
    
    // Visual properties
    position?: { x: number; y: number }
    metadata?: Record<string, any>
}

export interface FlowEdge {
    id: string
    source: string // source node ID
    target: string // target node ID
    label?: string // optional label for the edge (e.g., "onClick", "fetch")
    type?: "dataflow" | "call" | "render" | "event"
}

export interface DiagramMetadata {
    timestamp: number
    maxDepth: number
    totalNodes: number
    language?: string // "typescript", "python", "javascript"
    framework?: string // "react", "vue", "express", "django"
}
```

---

## 3. gRPC Protocol Definition

### 3.1 Proto Messages

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/proto/cline/visualization.proto`

```protobuf
syntax = "proto3";

package cline;

import "cline/common.proto";

option go_package = "github.com/cline/grpc-go/cline";
option java_multiple_files = true;
option java_package = "bot.cline.proto";

// Service for code visualization operations
service VisualizationService {
  // Save a code flow diagram to disk
  rpc saveDiagram(SaveDiagramRequest) returns (String);
  
  // Load a diagram by ID
  rpc loadDiagram(StringRequest) returns (DiagramData);
  
  // List all saved diagrams for current workspace
  rpc listDiagrams(EmptyRequest) returns (DiagramList);
  
  // Delete a diagram
  rpc deleteDiagram(StringRequest) returns (Empty);
  
  // Get visualization settings
  rpc getVisualizationSettings(EmptyRequest) returns (VisualizationSettings);
  
  // Update visualization settings
  rpc updateVisualizationSettings(VisualizationSettings) returns (Empty);
  
  // Subscribe to diagram updates (for real-time updates)
  rpc subscribeToDiagramUpdates(EmptyRequest) returns (stream DiagramUpdateEvent);
}

message SaveDiagramRequest {
  Metadata metadata = 1;
  string diagram_json = 2; // JSON string of CodeFlowDiagram
}

message DiagramData {
  string id = 1;
  string diagram_json = 2;
  int64 created_at = 3;
  string entry_point = 4;
  string description = 5;
}

message DiagramList {
  repeated DiagramInfo diagrams = 1;
}

message DiagramInfo {
  string id = 1;
  string entry_point = 2;
  string description = 3;
  int64 created_at = 4;
  int32 node_count = 5;
}

message VisualizationSettings {
  string storage_location = 1; // e.g., ".vscode/codeviz"
  bool auto_layout = 2;
  string default_layout_direction = 3; // "TB", "LR", "RL", "BT"
}

message DiagramUpdateEvent {
  string diagram_id = 1;
  string event_type = 2; // "created", "updated", "deleted"
}
```

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/proto/cline/ui.proto`

Add new ClineSay enum value:
```protobuf
enum ClineSay {
  // ... existing values
  TRACE_CODE_FLOW = 33;
}
```

### 3.2 Proto Conversions

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/proto-conversions/visualization.ts`

```typescript
import { CodeFlowDiagram } from "@/shared/code-visualization/types"
import { DiagramData, SaveDiagramRequest } from "@/shared/proto/cline/visualization"

export function convertDiagramToProto(diagram: CodeFlowDiagram, id: string): DiagramData {
    return DiagramData.create({
        id,
        diagramJson: JSON.stringify(diagram),
        createdAt: diagram.metadata.timestamp,
        entryPoint: diagram.entryPoint,
        description: diagram.description,
    })
}

export function convertProtoToDiagram(proto: DiagramData): CodeFlowDiagram {
    return JSON.parse(proto.diagramJson)
}
```

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/proto-conversions/cline-message.ts`

Add conversion for new ClineSay type:
```typescript
case ClineSay.TRACE_CODE_FLOW:
    return {
        type: "say",
        say: "trace_code_flow",
        text: clineMessage.text,
    }
```

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/ExtensionMessage.ts`

Add new say type:
```typescript
export type ClineSay =
    | "task"
    // ... existing types
    | "trace_code_flow"

export interface ClineSayTraceCodeFlow {
    status: "tracing" | "analyzing" | "complete" | "error"
    entryPoint: string
    description: string
    diagramPath?: string
    nodeCount?: number
    error?: string
}
```

### 3.3 gRPC Handlers

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/controller/visualization/saveDiagram.ts`

```typescript
import type { HandlerConfig } from "../types"
import { SaveDiagramRequest, String as ProtoString } from "@/shared/proto/cline/visualization"
import { atomicWriteFile } from "@/utils/fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

export async function saveDiagram(
    config: HandlerConfig,
    req: SaveDiagramRequest
): Promise<ProtoString> {
    const { stateManager } = config
    
    // Get visualization settings
    const settings = stateManager.getGlobalSettingsKey("visualizationSettings") || {
        storageLocation: ".vscode/codeviz",
    }
    
    // Generate unique ID
    const diagramId = uuidv4()
    const filename = `flow-${diagramId}.json`
    
    // Get workspace root
    const workspaceRoot = config.extensionContext.workspaceState.get("workspaceRoot") || process.cwd()
    const storagePath = path.join(workspaceRoot, settings.storageLocation)
    const filePath = path.join(storagePath, filename)
    
    // Ensure directory exists
    await fs.mkdir(storagePath, { recursive: true })
    
    // Save diagram using atomic write
    await atomicWriteFile(filePath, req.diagramJson)
    
    return ProtoString.create({ value: diagramId })
}
```

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/controller/visualization/loadDiagram.ts`

```typescript
import type { HandlerConfig } from "../types"
import { StringRequest, DiagramData } from "@/shared/proto/cline/visualization"
import fs from "fs/promises"
import path from "path"

export async function loadDiagram(
    config: HandlerConfig,
    req: StringRequest
): Promise<DiagramData> {
    const { stateManager } = config
    const diagramId = req.value
    
    // Get storage location
    const settings = stateManager.getGlobalSettingsKey("visualizationSettings") || {
        storageLocation: ".vscode/codeviz",
    }
    
    const workspaceRoot = config.extensionContext.workspaceState.get("workspaceRoot") || process.cwd()
    const storagePath = path.join(workspaceRoot, settings.storageLocation)
    const filePath = path.join(storagePath, `flow-${diagramId}.json`)
    
    // Read diagram file
    const diagramJson = await fs.readFile(filePath, "utf-8")
    const diagram = JSON.parse(diagramJson)
    
    return DiagramData.create({
        id: diagramId,
        diagramJson,
        createdAt: diagram.metadata.timestamp,
        entryPoint: diagram.entryPoint,
        description: diagram.description,
    })
}
```

**Similar handlers needed for:**
- `listDiagrams.ts` - List all diagrams in workspace
- `deleteDiagram.ts` - Delete a diagram
- `getVisualizationSettings.ts` - Get settings
- `updateVisualizationSettings.ts` - Update settings

---

## 4. Storage Implementation

### 4.1 StateManager Integration

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/storage/state-keys.ts`

Add visualization settings:
```typescript
const USER_SETTINGS_FIELDS = {
    // ... existing fields
    visualizationSettings: {
        default: {
            storageLocation: ".vscode/codeviz",
            autoLayout: true,
            defaultLayoutDirection: "TB",
        } as VisualizationSettings,
    },
}
```

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/storage/visualization-storage.ts`

```typescript
import { CodeFlowDiagram } from "@/shared/code-visualization/types"
import { atomicWriteFile } from "@/utils/fs"
import fs from "fs/promises"
import path from "path"

export class VisualizationStorage {
    constructor(private workspaceRoot: string, private storageLocation: string) {}
    
    async saveDiagram(diagram: CodeFlowDiagram, id: string): Promise<string> {
        const storagePath = path.join(this.workspaceRoot, this.storageLocation)
        await fs.mkdir(storagePath, { recursive: true })
        
        const filename = `flow-${id}.json`
        const filePath = path.join(storagePath, filename)
        
        await atomicWriteFile(filePath, JSON.stringify(diagram, null, 2))
        
        return path.relative(this.workspaceRoot, filePath)
    }
    
    async loadDiagram(id: string): Promise<CodeFlowDiagram> {
        const filePath = path.join(this.workspaceRoot, this.storageLocation, `flow-${id}.json`)
        const content = await fs.readFile(filePath, "utf-8")
        return JSON.parse(content)
    }
    
    async listDiagrams(): Promise<Array<{ id: string; metadata: any }>> {
        const storagePath = path.join(this.workspaceRoot, this.storageLocation)
        
        try {
            const files = await fs.readdir(storagePath)
            const diagrams = []
            
            for (const file of files) {
                if (file.startsWith("flow-") && file.endsWith(".json")) {
                    const id = file.replace("flow-", "").replace(".json", "")
                    const filePath = path.join(storagePath, file)
                    const content = await fs.readFile(filePath, "utf-8")
                    const diagram = JSON.parse(content)
                    
                    diagrams.push({
                        id,
                        metadata: diagram.metadata,
                        entryPoint: diagram.entryPoint,
                        description: diagram.description,
                    })
                }
            }
            
            return diagrams
        } catch (error) {
            if (error.code === "ENOENT") {
                return []
            }
            throw error
        }
    }
    
    async deleteDiagram(id: string): Promise<void> {
        const filePath = path.join(this.workspaceRoot, this.storageLocation, `flow-${id}.json`)
        await fs.unlink(filePath)
    }
}
```

---

## 5. React Flow Integration

### 5.1 Package Installation

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/package.json`

Add dependency:
```json
{
  "dependencies": {
    // ... existing dependencies
    "reactflow": "^11.11.0",
    "@xyflow/react": "^12.0.0"
  }
}
```

Run: `npm install` in webview-ui directory

### 5.2 Diagram Component

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/visualization/CodeFlowDiagram.tsx`

```typescript
import { useCallback, useState } from "react"
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Panel,
} from "reactflow"
import "reactflow/dist/style.css"
import { CodeFlowDiagram as DiagramData } from "@/shared/code-visualization/types"
import { FlowNodeComponent } from "./FlowNodeComponent"
import { NodeDetailsModal } from "./NodeDetailsModal"

const nodeTypes = {
    codeFlowNode: FlowNodeComponent,
}

interface CodeFlowDiagramProps {
    diagram: DiagramData
    onNodeClick?: (nodeId: string) => void
}

export function CodeFlowDiagram({ diagram, onNodeClick }: CodeFlowDiagramProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(convertToReactFlowNodes(diagram.nodes))
    const [edges, setEdges, onEdgesChange] = useEdgesState(convertToReactFlowEdges(diagram.edges))
    const [selectedNode, setSelectedNode] = useState<string | null>(null)
    
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    )
    
    const handleNodeClick = useCallback(
        (event: React.MouseEvent, node: Node) => {
            setSelectedNode(node.id)
            onNodeClick?.(node.id)
        },
        [onNodeClick]
    )
    
    const selectedNodeData = diagram.nodes.find(n => n.id === selectedNode)
    
    return (
        <div className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap />
                <Panel position="top-left">
                    <div className="bg-white p-2 rounded shadow">
                        <h3 className="font-semibold">{diagram.description}</h3>
                        <p className="text-sm text-gray-600">Entry: {diagram.entryPoint}</p>
                    </div>
                </Panel>
            </ReactFlow>
            
            {selectedNode && selectedNodeData && (
                <NodeDetailsModal
                    node={selectedNodeData}
                    onClose={() => setSelectedNode(null)}
                />
            )}
        </div>
    )
}

function convertToReactFlowNodes(nodes: FlowNode[]): Node[] {
    return nodes.map(node => ({
        id: node.id,
        type: "codeFlowNode",
        data: { ...node },
        position: node.position || { x: 0, y: 0 },
    }))
}

function convertToReactFlowEdges(edges: FlowEdge[]): Edge[] {
    return edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type === "event" ? "smoothstep" : "default",
    }))
}
```

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/visualization/FlowNodeComponent.tsx`

```typescript
import { Handle, Position } from "reactflow"
import { FlowNode } from "@/shared/code-visualization/types"
import { FileCode2Icon, DatabaseIcon, CloudIcon, ComponentIcon } from "lucide-react"

interface FlowNodeProps {
    data: FlowNode
}

export function FlowNodeComponent({ data }: FlowNodeProps) {
    const getIcon = () => {
        switch (data.type) {
            case "component":
                return <ComponentIcon className="w-4 h-4" />
            case "database":
                return <DatabaseIcon className="w-4 h-4" />
            case "external":
                return <CloudIcon className="w-4 h-4" />
            default:
                return <FileCode2Icon className="w-4 h-4" />
        }
    }
    
    const getBackgroundColor = () => {
        switch (data.type) {
            case "entry":
                return "bg-green-100 border-green-500"
            case "component":
                return "bg-blue-100 border-blue-500"
            case "function":
                return "bg-purple-100 border-purple-500"
            case "api":
                return "bg-orange-100 border-orange-500"
            case "database":
                return "bg-red-100 border-red-500"
            case "external":
                return "bg-gray-100 border-gray-500"
            default:
                return "bg-white border-gray-300"
        }
    }
    
    return (
        <div className={`px-4 py-2 rounded border-2 ${getBackgroundColor()} min-w-[150px] cursor-pointer hover:shadow-lg transition-shadow`}>
            <Handle type="target" position={Position.Top} />
            
            <div className="flex items-center gap-2">
                {getIcon()}
                <div>
                    <div className="font-semibold text-sm">{data.label}</div>
                    <div className="text-xs text-gray-600">{data.filePath}</div>
                </div>
            </div>
            
            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}
```

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/visualization/NodeDetailsModal.tsx`

```typescript
import { FlowNode } from "@/shared/code-visualization/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileServiceClient } from "@/services/grpc-client"
import { StringRequest } from "@/shared/proto/cline/common"

interface NodeDetailsModalProps {
    node: FlowNode
    onClose: () => void
}

export function NodeDetailsModal({ node, onClose }: NodeDetailsModalProps) {
    const handleViewCode = async () => {
        // Open file in editor at specific line
        await FileServiceClient.openFile(StringRequest.create({
            value: `${node.filePath}:${node.lineNumber || 1}`
        }))
    }
    
    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{node.label}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    <Section title="Component Responsibility">
                        <p>{node.componentResponsibility}</p>
                    </Section>
                    
                    <Section title="Input Data">
                        <p>{node.inputDescription}</p>
                    </Section>
                    
                    <Section title="Output Data">
                        <p>{node.outputDescription}</p>
                    </Section>
                    
                    <Section title="File Responsibility">
                        <p>{node.fileResponsibility}</p>
                    </Section>
                    
                    <Section title="Code Explanation">
                        <p>{node.codeSegmentDescription}</p>
                    </Section>
                    
                    <Section title="Code Segment">
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                            <code>{node.codeSegment}</code>
                        </pre>
                        <button
                            onClick={handleViewCode}
                            className="mt-2 text-blue-600 hover:underline text-sm"
                        >
                            View in Editor →
                        </button>
                    </Section>
                    
                    <Section title="File Location">
                        <p className="text-sm font-mono">{node.filePath}:{node.lineNumber}</p>
                    </Section>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="font-semibold text-sm mb-1">{title}</h3>
            <div className="text-sm text-gray-700">{children}</div>
        </div>
    )
}
```

### 5.3 Visualization View

**File to Create:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/visualization/VisualizationView.tsx`

```typescript
import { useEffect, useState } from "react"
import { CodeFlowDiagram as DiagramData } from "@/shared/code-visualization/types"
import { VisualizationServiceClient } from "@/services/grpc-client"
import { StringRequest, EmptyRequest } from "@/shared/proto/cline/common"
import { CodeFlowDiagram } from "./CodeFlowDiagram"
import { XIcon, RefreshCwIcon } from "lucide-react"

interface VisualizationViewProps {
    diagramId: string | null
    onClose: () => void
}

export function VisualizationView({ diagramId, onClose }: VisualizationViewProps) {
    const [diagram, setDiagram] = useState<DiagramData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    useEffect(() => {
        if (diagramId) {
            loadDiagram(diagramId)
        }
    }, [diagramId])
    
    const loadDiagram = async (id: string) => {
        setLoading(true)
        setError(null)
        
        try {
            const response = await VisualizationServiceClient.loadDiagram(
                StringRequest.create({ value: id })
            )
            const diagramData = JSON.parse(response.diagramJson)
            setDiagram(diagramData)
        } catch (err) {
            setError(`Failed to load diagram: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }
    
    const handleRefresh = () => {
        if (diagramId) {
            loadDiagram(diagramId)
        }
    }
    
    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Code Flow Visualization</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Refresh"
                    >
                        <RefreshCwIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-gray-500">Loading diagram...</div>
                    </div>
                )}
                
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-red-500">{error}</div>
                    </div>
                )}
                
                {diagram && !loading && !error && (
                    <CodeFlowDiagram diagram={diagram} />
                )}
            </div>
        </div>
    )
}
```

### 5.4 Integration with App.tsx

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/App.tsx`

```typescript
import VisualizationView from "./components/visualization/VisualizationView"

const AppContent = () => {
    const {
        // ... existing state
        showVisualization,
        currentDiagramId,
        hideVisualization,
    } = useExtensionState()
    
    return (
        <div className="flex h-screen w-full flex-col">
            {showSettings && <SettingsView onDone={hideSettings} targetSection={settingsTargetSection} />}
            {showHistory && <HistoryView onDone={hideHistory} />}
            {showMcp && <McpView initialTab={mcpTab} onDone={closeMcpView} />}
            {showAccount && <AccountView ... />}
            {showVisualization && (
                <VisualizationView
                    diagramId={currentDiagramId}
                    onClose={hideVisualization}
                />
            )}
            
            <ChatView
                isHidden={showSettings || showHistory || showMcp || showAccount || showVisualization}
                // ... other props
            />
        </div>
    )
}
```

**Update ExtensionStateContext:** Add visualization state management

---

## 6. UI/UX Flow

### 6.1 Chat Integration

**Update:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/chat/ChatRow.tsx`

Add rendering for trace_code_flow messages:

```typescript
if (message.say === "trace_code_flow") {
    const traceInfo = JSON.parse(message.text || "{}")
    
    return (
        <div className="flex items-start gap-2">
            <div className="flex-1">
                {traceInfo.status === "tracing" && (
                    <div className="flex items-center gap-2">
                        <LoaderCircleIcon className="w-4 h-4 animate-spin" />
                        <span>Tracing code flow from {traceInfo.entryPoint}...</span>
                    </div>
                )}
                
                {traceInfo.status === "analyzing" && (
                    <div className="flex items-center gap-2">
                        <LoaderCircleIcon className="w-4 h-4 animate-spin" />
                        <span>Analyzing code flow...</span>
                    </div>
                )}
                
                {traceInfo.status === "complete" && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckIcon className="w-4 h-4 text-green-600" />
                            <span>Code flow trace complete</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                            <div>Entry: {traceInfo.entryPoint}</div>
                            <div>Nodes: {traceInfo.nodeCount}</div>
                        </div>
                        <button
                            onClick={() => handleViewDiagram(traceInfo.diagramId)}
                            className="text-blue-600 hover:underline"
                        >
                            View Interactive Diagram →
                        </button>
                    </div>
                )}
                
                {traceInfo.status === "error" && (
                    <div className="text-red-600">
                        Error: {traceInfo.error}
                    </div>
                )}
            </div>
        </div>
    )
}
```

### 6.2 Manual Trigger

Users can trigger visualization in three ways:

1. **Natural language in chat:** "Help me understand the login flow"
2. **Explicit tool call:** LLM decides to use trace_code_flow tool
3. **Follow-up questions:** Click on diagram nodes to ask questions about specific components

---

## 7. LLM Tracing Strategy

### 7.1 Multi-Step Prompting Approach

The `performLLMTrace` function uses a multi-step prompting strategy:

**Step 1: Initialize Entry Point**
```
Prompt: "Analyze the file at {entryPoint} and identify the starting function/component 
for: {description}. Return JSON with: function name, input parameters, and responsibility."
```

**Step 2: Iterative Tracing (repeated up to maxDepth)**
```
Prompt: "Given the function {currentFunction} in {currentFile}, identify:
1. What data flows INTO this function (parameters, props, state, context)
2. What this function DOES (responsibility)
3. What data flows OUT (return values, side effects, state updates, events)
4. What are the NEXT steps in the flow (function calls, component renders, API calls)

If this reaches an external boundary (API call, database, browser API), mark it as terminal.
Return JSON with: inputs, outputs, responsibility, next_nodes[]"
```

**Step 3: Generate Explanations**
```
Prompt: "For the code flow node representing {function} in {file}, generate:
1. Component/Function Responsibility (1-2 sentences, user-friendly)
2. Input Description (what data comes in, user-friendly)
3. Output Description (what data goes out, user-friendly)
4. File Responsibility (what is the purpose of this file)
5. Code Segment Description (explain the relevant code snippet)

Keep explanations concise and accessible to developers new to the codebase."
```

### 7.2 Tool Integration

The tracing process uses existing Cline tools:
- **read_file**: Read source files
- **search_files**: Find related files
- **list_code_definition_names**: Identify functions/components in files

### 7.3 Stopping Conditions

The trace stops when:
1. Max depth reached
2. External boundary encountered (API call, database, browser API, external library)
3. No more flow to trace (dead end)
4. Circular reference detected (prevent infinite loops)

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Test File:** `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/__tests__/visualization/trace-code-flow.test.ts`

```typescript
describe("TraceCodeFlowToolHandler", () => {
    test("should validate required parameters", async () => {
        // Test missing entry_point
        // Test missing description
    })
    
    test("should trace simple function call", async () => {
        // Create mock codebase with simple A->B flow
        // Verify nodes and edges generated correctly
    })
    
    test("should stop at max depth", async () => {
        // Create deep call chain
        // Verify stops at maxDepth
    })
    
    test("should identify external boundaries", async () => {
        // Test with API call (fetch)
        // Test with database call
        // Verify marked as terminal nodes
    })
})
```

### 8.2 Integration Tests

**Test scenarios:**
1. Simple React component onClick handler flow
2. API endpoint to database query
3. Complex multi-file data flow
4. Circular reference detection
5. Error handling (missing files, invalid entry points)

### 8.3 Manual Testing Checklist

- [ ] Tool appears in system prompt
- [ ] Tool can be called from chat
- [ ] Diagram saves to .vscode/codeviz/
- [ ] Visualization view opens
- [ ] React Flow diagram renders correctly
- [ ] Node click opens details modal
- [ ] All 6 pieces of information display
- [ ] Link to code segment opens file in editor
- [ ] Settings allow configuring storage location
- [ ] Multiple diagrams can be saved
- [ ] Diagram list shows all saved diagrams

---

## 9. Implementation Sequence

### Phase 1: Foundation (Week 1)
1. Add TRACE_CODE_FLOW to tools enum
2. Create tool definition files
3. Create proto definitions
4. Run `npm run protos`
5. Create basic data type definitions
6. Add to variant configs
7. Update snapshots

### Phase 2: Backend (Week 2)
1. Implement TraceCodeFlowToolHandler skeleton
2. Implement basic LLM tracing logic
3. Create gRPC handlers (save, load, list)
4. Implement VisualizationStorage
5. Add StateManager integration
6. Test backend independently

### Phase 3: Frontend (Week 3)
1. Install React Flow dependency
2. Create CodeFlowDiagram component
3. Create FlowNodeComponent
4. Create NodeDetailsModal
5. Create VisualizationView
6. Integrate with App.tsx
7. Add ChatRow rendering

### Phase 4: Refinement (Week 4)
1. Improve LLM tracing prompts
2. Add auto-layout logic
3. Improve node styling
4. Add error handling
5. Add loading states
6. Improve explanations quality
7. Write tests
8. Documentation

### Phase 5: Polish (Week 5)
1. Performance optimization
2. Handle large diagrams
3. Add export functionality (PNG, SVG)
4. Add zoom/pan presets
5. Add diagram sharing
6. User feedback integration
7. Final testing

---

## 10. Critical Files for Implementation

### Priority 1 (Start here):
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/tools.ts` - Add enum value
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/prompts/system-prompt/tools/trace_code_flow.ts` - Tool definition
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/proto/cline/visualization.proto` - gRPC protocol
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/code-visualization/types.ts` - Data structures

### Priority 2 (Core logic):
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/task/tools/handlers/TraceCodeFlowToolHandler.ts` - Main handler implementation
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/storage/visualization-storage.ts` - Storage layer
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/core/controller/visualization/` - gRPC handler directory

### Priority 3 (UI):
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/visualization/CodeFlowDiagram.tsx` - Main diagram component
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/visualization/NodeDetailsModal.tsx` - Details modal
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/App.tsx` - Integration point

### Priority 4 (Integration):
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/proto-conversions/cline-message.ts` - Message conversions
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/webview-ui/src/components/chat/ChatRow.tsx` - Chat rendering
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/src/shared/storage/state-keys.ts` - Settings integration

### Priority 5 (Testing):
- `/Users/mac/Desktop/Coding/projects/codeviz/codeviz/__tests__/visualization/` - Test directory
- Update system prompt snapshots after changes

---

## 11. Key Design Considerations

### 11.1 Performance
- **Large diagrams:** Implement virtualization for 100+ nodes
- **LLM calls:** Batch analysis where possible to reduce API calls
- **Caching:** Cache file reads during single trace operation

### 11.2 Error Handling
- **Missing files:** Gracefully handle deleted/moved files
- **Invalid entry points:** Clear error messages
- **LLM failures:** Retry logic with exponential backoff
- **Circular references:** Detect and break cycles

### 11.3 User Experience
- **Loading states:** Show progress during long traces
- **Cancellation:** Allow users to cancel long-running traces
- **Auto-save:** Save diagram incrementally during tracing
- **Keyboard shortcuts:** Navigate diagram with arrow keys

### 11.4 Extensibility
- **Language support:** Design to support multiple languages (start with JS/TS/Python)
- **Framework detection:** Auto-detect React/Vue/Express/Django patterns
- **Custom analyzers:** Plugin architecture for language-specific analysis

---

## 12. Follow-up Features (Future)

### 12.1 Enhanced Visualization
- Multiple diagram layouts (hierarchical, radial, force-directed)
- Highlight critical paths
- Show data transformations on edges
- Timeline view showing order of execution

### 12.2 Interactive Features
- Click node to ask follow-up questions
- Edit diagram manually
- Annotate nodes with notes
- Share diagrams with team

### 12.3 Analysis Features
- Identify bottlenecks
- Show complexity metrics
- Highlight unused code paths
- Security vulnerability detection

---

## Notes for Implementation

1. **Always run `npm run protos` after modifying .proto files**
2. **Update system prompt snapshots with `UPDATE_SNAPSHOTS=true npm run test:unit`**
3. **Follow existing patterns from generate_explanation tool for complex visualizations**
4. **Use existing read_file and search_files tools for code analysis**
5. **Test with multiple languages (JS/TS first, then Python)**
6. **Start with simple linear flows before tackling branching logic**
7. **Use Mermaid.js as fallback if React Flow has issues**
8. **Consider memory usage with large codebases - implement lazy loading**

---

## End of Implementation Plan

This plan provides a comprehensive roadmap for implementing code visualization in Cline. The modular design follows Cline's architectural patterns and integrates seamlessly with existing features.

**Estimated Effort:** 4-6 weeks for full implementation
**Team Size:** 1-2 developers
**Skills Required:** TypeScript, React, gRPC/Protobuf, LLM prompting

