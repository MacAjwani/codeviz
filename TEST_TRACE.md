# Testing the Trace Code Flow Feature

## Quick Test Checklist

### Setup
- [ ] Press F5 to launch Extension Development Host
- [ ] Open a TypeScript/JavaScript project
- [ ] Open Cline panel

### Test 1: Simple Trace
**Request:** "Trace the code flow from src/extension.ts to understand activation"

**Expected:**
- [ ] Claude calls `trace_code_flow` tool
- [ ] Shows "Initializing..." status
- [ ] Shows "Analyzing..." for each file
- [ ] Shows "Node added" messages
- [ ] Completes successfully
- [ ] File created at `.vscode/codeviz/diagrams/*.json`

**Inspect the JSON:**
```bash
cat .vscode/codeviz/diagrams/*.json | jq '.'
```

Should contain:
- [ ] `entryPoint` field
- [ ] `description` field
- [ ] `nodes` array with multiple nodes
- [ ] `edges` array connecting nodes
- [ ] `metadata` with timestamp

### Test 2: Verify Node Structure

Each node should have:
- [ ] `id`
- [ ] `type` (entry, component, function, etc.)
- [ ] `label`
- [ ] `filePath`
- [ ] `componentResponsibility`
- [ ] `inputDescription`
- [ ] `outputDescription`
- [ ] `codeSegment`

### Test 3: Verify Edge Structure

Each edge should have:
- [ ] `id`
- [ ] `source` (node ID)
- [ ] `target` (node ID)
- [ ] `label` (optional)
- [ ] `type` (dataflow, call, etc.)

### Test 4: Error Handling

**Test invalid entry point:**
```
Trace from nonexistent/file.ts
```
Expected: "Entry point file not found" error

**Test missing description:**
Try calling without description context
Expected: Should prompt or provide default

### Test 5: Depth Limiting

**Request:** "Trace from src/extension.ts with max_depth of 2"

Expected:
- [ ] Stops at depth 2
- [ ] Doesn't trace beyond 2 levels

### Test 6: Console Inspection

Open Developer Tools (Help → Toggle Developer Tools)

**Look for:**
- [ ] No uncaught exceptions
- [ ] Internal API call logs
- [ ] File read operations
- [ ] Diagram save confirmation

### Test 7: API Call Monitoring

**Count internal API calls:**
- Each node analyzed = 1 API call
- Entry point + (n-1) nodes = n total calls
- Should be proportional to nodes traced

### What You Won't See Yet (UI Not Integrated)

❌ Progress updates in the chat (only in message history)
❌ "View Diagram" button
❌ Interactive diagram visualization
❌ Diagram panel opening

These require the ChatRow.tsx and App.tsx integration (next step).

## Sample Test Code

Create a simple test file to trace:

**test-trace/index.ts:**
```typescript
import { helper } from './helper'

export function main() {
    const result = helper.process("test")
    return result
}
```

**test-trace/helper.ts:**
```typescript
import { api } from './api'

export const helper = {
    process(input: string) {
        return api.fetch(input)
    }
}
```

**test-trace/api.ts:**
```typescript
export const api = {
    fetch(data: string) {
        return fetch(`/api?q=${data}`)
    }
}
```

**Request:** "Trace from test-trace/index.ts to understand the data flow"

**Expected Nodes:**
1. main (entry, function)
2. helper.process (function)
3. api.fetch (api or external)

## Debugging Tips

### If tool isn't called:
```bash
# Check if tool is in system prompt
npm run test:unit | grep trace_code_flow
```

### If API calls fail:
Check Settings → API Configuration is valid

### If files aren't created:
```bash
# Check directory permissions
ls -la .vscode/
ls -la .vscode/codeviz/
```

### If JSON is malformed:
Check console logs for the raw LLM response to see what it returned

## Success Criteria

✅ Tool is called by Claude
✅ Entry point is parsed correctly
✅ Multiple nodes are traced (2+)
✅ Diagram JSON is saved to disk
✅ JSON is valid and well-formed
✅ No errors in console
✅ Tool returns success message

Once all these pass, we're ready for UI integration!
