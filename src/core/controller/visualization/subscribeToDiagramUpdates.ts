import type { EmptyRequest } from "@/shared/proto/cline/common"
import type { DiagramUpdateEvent } from "@/shared/proto/cline/visualization"
import type { StreamingResponseHandler } from "../grpc-handler"
import type { Controller } from "../index"

/**
 * Handler for subscribing to diagram update events
 * TODO: Implement in Phase 2
 */
export async function subscribeToDiagramUpdates(
	_controller: Controller,
	_req: EmptyRequest,
	_responseStream: StreamingResponseHandler<DiagramUpdateEvent>,
	_requestId?: string,
): Promise<void> {
	// Stub implementation - will be implemented in Phase 2
	// This is a streaming endpoint, no response needed
}
