import type { ContextNode, InteractionEdge } from "../types";

export const initialTestNodes: ContextNode[] = [
  {
    id: "screen-home",
    type: "context",
    position: { x: 100, y: 120 },
    data: {
      kind: "screen",
      name: "Home View",
      items: [
        {
          type: "component",
          id: "comp-header",
          name: "Navigation Header",
          elements: [
            { id: "el-logo", kind: "image", label: "App Logo", interactive: false },
            { id: "el-search", kind: "input", label: "Search Bar", interactive: true },
            { id: "el-profile", kind: "button", label: "Profile Button", interactive: true },
          ],
        },
        {
          type: "component",
          id: "comp-feed",
          name: "Main Dashboard",
          elements: [
            { id: "el-chart", kind: "image", label: "Analytics Chart", interactive: true },
            { id: "el-export", kind: "button", label: "Export Report", interactive: true },
          ],
        },
      ],
    },
  },
  {
    id: "modal-settings",
    type: "context",
    position: { x: 550, y: 80 },
    data: {
      kind: "modal",
      name: "User Settings Modal",
      items: [
        {
          type: "component",
          id: "comp-prefs",
          name: "Preferences Form",
          elements: [
            { id: "el-theme", kind: "button", label: "Dark Mode Switch", interactive: true },
            { id: "el-notifs", kind: "button", label: "Notification Settings", interactive: true },
            { id: "el-save", kind: "button", label: "Save Changes", interactive: true },
          ],
        },
      ],
    },
  },
  {
    id: "sheet-details",
    type: "context",
    position: { x: 550, y: 380 },
    data: {
      kind: "sheet",
      name: "Item Detail Sheet",
      items: [
        {
          type: "element",
          id: "el-detail-title",
          kind: "text",
          label: "Item Title",
          interactive: false,
        },
        {
          type: "element",
          id: "el-detail-buy",
          kind: "button",
          label: "Checkout Button",
          interactive: true,
        },
      ],
    },
  },
];

export const initialTestEdges: InteractionEdge[] = [
  {
    id: "edge-1",
    type: "interaction",
    source: "screen-home",
    sourceHandle: "exit:el-profile",
    target: "modal-settings",
    targetHandle: "entry",
    label: "Open Profile",
    data: { interaction: "Open Settings Modal" },
  },
  {
    id: "edge-2",
    type: "interaction",
    source: "screen-home",
    sourceHandle: "exit:el-export",
    target: "sheet-details",
    targetHandle: "entry",
    label: "View Detail",
    data: { interaction: "Open Item Detail Sheet" },
  },
];

export function generateStressTestGraph(nodeCount = 50): {
  nodes: ContextNode[];
  edges: InteractionEdge[];
} {
  const nodes: ContextNode[] = [];
  const edges: InteractionEdge[] = [];
  const cols = 5;

  for (let i = 0; i < nodeCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const id = `node-stress-${i}`;

    nodes.push({
      id,
      type: "context",
      position: { x: col * 340 + 80, y: row * 260 + 80 },
      data: {
        kind: i % 2 === 0 ? "screen" : "popover",
        name: `Node #${i + 1}`,
        items: [
          {
            type: "component",
            id: `comp-stress-${i}`,
            name: `Widget Group ${i + 1}`,
            elements: [
              {
                id: `el-action-${i}-1`,
                kind: "button",
                label: `Action ${i}.1`,
                interactive: true,
              },
              {
                id: `el-action-${i}-2`,
                kind: "button",
                label: `Action ${i}.2`,
                interactive: true,
              },
            ],
          },
        ],
      },
    });

    if (i > 0 && i % 2 === 0) {
      edges.push({
        id: `edge-stress-${i}`,
        type: "interaction",
        source: `node-stress-${i - 2}`,
        sourceHandle: `exit:el-action-${i - 2}-1`,
        target: id,
        targetHandle: "entry",
        label: "trigger",
        data: { interaction: `Transition to #${i + 1}` },
      });
    }
  }

  return { nodes, edges };
}
