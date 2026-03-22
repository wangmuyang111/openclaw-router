import type { RoutingPageModel } from "./routing-control-page-model.js";

export type DemoPanelBlock = {
  kind: "runtime" | "sessions" | "detail";
  title: string;
  status: string;
  lines: string[];
};

export type RoutingDemoPageContract = {
  title: string;
  subtitle: string;
  blocks: DemoPanelBlock[];
};

function withStatusTitle(title: string, status: string): string {
  return `${title} [${status}]`;
}

export function createRoutingDemoPageContract(model: RoutingPageModel): RoutingDemoPageContract {
  const runtimeLines = model.runtimePanel.summaryLines.length
    ? model.runtimePanel.summaryLines
    : [model.runtimePanel.message ?? "No runtime data"];

  const sessionsLines = model.sessionsPanel.items.length
    ? model.sessionsPanel.items.map((item) => {
        const segments = [item.sessionKey, item.primaryLabel];
        if (item.temporaryLabel) segments.push(`tmp=${item.temporaryLabel}`);
        if (item.pendingLabel) segments.push(`pending=${item.pendingLabel}`);
        segments.push(item.activityLabel);
        if (item.isSelected) segments.push("selected");
        return segments.join(" | ");
      })
    : [model.sessionsPanel.emptyMessage ?? model.sessionsPanel.message ?? "No sessions"];

  const detailLines = model.detailPanel.fields.length
    ? model.detailPanel.fields.map((field) => `${field.label}: ${field.value}`)
    : [model.detailPanel.emptyMessage ?? model.detailPanel.message ?? "No detail"];

  return {
    title: model.pageTitle,
    subtitle: `Selected: ${model.selectedSessionKey ?? "none"} · Loaded: ${model.lastLoadedAtLabel}`,
    blocks: [
      {
        kind: "runtime",
        title: withStatusTitle(model.runtimePanel.title, model.runtimePanel.status),
        status: model.runtimePanel.status,
        lines: runtimeLines,
      },
      {
        kind: "sessions",
        title: withStatusTitle(model.sessionsPanel.title, model.sessionsPanel.status),
        status: model.sessionsPanel.status,
        lines: sessionsLines,
      },
      {
        kind: "detail",
        title: withStatusTitle(model.detailPanel.title, model.detailPanel.status),
        status: model.detailPanel.status,
        lines: detailLines,
      },
    ],
  };
}

export function renderRoutingDemoPageText(contract: RoutingDemoPageContract): string {
  const parts: string[] = [];
  parts.push(`# ${contract.title}`);
  parts.push(contract.subtitle);

  for (const block of contract.blocks) {
    parts.push("");
    parts.push(`## ${block.title}`);
    for (const line of block.lines) {
      parts.push(`- ${line}`);
    }
  }

  return parts.join("\n");
}
