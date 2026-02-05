import { GenerateArchitectureDiagramRequest } from "@/shared/proto/cline/architecture"
import { String as ProtoString } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for generating architecture diagram
 * NOTE: This is primarily handled by the GenerateArchitectureDiagramToolHandler
 * This handler exists for direct gRPC calls if needed
 */
export async function generateArchitectureDiagram(
	_controller: Controller,
	_req: GenerateArchitectureDiagramRequest,
): Promise<ProtoString> {
	// For now, return a message indicating this should be done via the tool
	// In the future, we could invoke the tool handler directly here
	return ProtoString.create({
		value: "Architecture diagram generation should be triggered via the generate_architecture_diagram tool",
	})
}
