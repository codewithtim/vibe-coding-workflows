#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { opStatus, opStart, opAdvance, opBack, opLoop, opCheck, opEnd, opFlows } from "./ops.js";
import { listFlows } from "./flows.js";

const server = new Server(
  { name: "workflow-pilot", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "workflow_status",
      description:
        "Get current workflow stage, instructions, checklist, and available transitions. Call this before every response to follow stage-appropriate guidelines.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "workflow_advance",
      description: "Move to the next stage in the workflow.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "workflow_back",
      description: "Go back to the previous stage in the workflow.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "workflow_loop",
      description: "Repeat the current stage (e.g. another annotation cycle).",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "workflow_checklist",
      description: "Toggle a checklist item by 1-based index.",
      inputSchema: {
        type: "object",
        properties: {
          item: { type: "number", description: "1-based index of the checklist item to toggle" },
        },
        required: ["item"],
      },
    },
    {
      name: "workflow_list_flows",
      description: "List all available workflow definitions.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "workflow_start",
      description: "Start a new workflow session with the given flow ID.",
      inputSchema: {
        type: "object",
        properties: {
          flow_id: { type: "string", description: "ID of the flow to start (e.g. boris-feature, bugfix)" },
        },
        required: ["flow_id"],
      },
    },
    {
      name: "workflow_end",
      description: "End the current workflow session.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  function respond(result: { ok: true; message: string } | { ok: false; error: string }) {
    const text = result.ok ? result.message : `Error: ${result.error}`;
    return {
      content: [{ type: "text" as const, text }],
      isError: !result.ok,
    };
  }

  switch (name) {
    case "workflow_status":
      return respond(opStatus());

    case "workflow_advance":
      return respond(opAdvance());

    case "workflow_back":
      return respond(opBack());

    case "workflow_loop":
      return respond(opLoop());

    case "workflow_checklist": {
      const parsed = z.object({ item: z.number() }).safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: "text", text: "Error: item (number) is required" }], isError: true };
      }
      return respond(opCheck(parsed.data.item));
    }

    case "workflow_list_flows": {
      const flows = listFlows();
      if (flows.length === 0) {
        return { content: [{ type: "text", text: "No flows found in ~/.workflow-pilot/flows/" }] };
      }
      const text = flows.map((f) => `${f.id}: ${f.name} — ${f.description}`).join("\n");
      return { content: [{ type: "text", text }] };
    }

    case "workflow_start": {
      const parsed = z.object({ flow_id: z.string() }).safeParse(args);
      if (!parsed.success) {
        return { content: [{ type: "text", text: "Error: flow_id (string) is required" }], isError: true };
      }
      return respond(opStart(parsed.data.flow_id));
    }

    case "workflow_end":
      return respond(opEnd());

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
