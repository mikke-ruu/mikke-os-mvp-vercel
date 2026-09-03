import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

const LEGAL_DOCUMENTS = new Set([
  "academy-billing-2026-09-04-v1.md",
  "academy-terms-2026-09-04-v1.md",
  "commercial-disclosure-2026-09-04-v1.md",
  "community-billing-2026-09-04-v1.md",
  "community-terms-2026-09-04-v1.md",
  "privacy-2026-09-04-v1.md"
]);

function sectionId(heading: string) {
  if (heading.includes("返金")) return "refund";
  if (heading.includes("解約")) return "cancellation";
  if (heading.includes("日割り")) return "proration";
  if (heading.includes("初回請求と更新")) return "renewal";
  return undefined;
}

function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      nodes.push(<h1 key={index} className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">{line.slice(2)}</h1>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      const heading = line.slice(3);
      nodes.push(<h2 key={index} id={sectionId(heading)} className="scroll-mt-6 pt-5 text-xl font-bold text-slate-950">{heading}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(<ul key={`list-${index}`} className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700 sm:text-base">{items.map((item) => <li key={item}>{item}</li>)}</ul>);
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(lines[index].trim().slice(1, -1).split("|").map((cell) => cell.trim()));
        index += 1;
      }
      const [header, , ...body] = rows;
      nodes.push(
        <div key={`table-${index}`} className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm leading-6">
            <thead className="bg-slate-50"><tr>{header.map((cell) => <th key={cell} className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">{cell}</th>)}</tr></thead>
            <tbody>{body.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100 last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="align-top px-4 py-3 text-slate-700">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || next.startsWith("#") || next.startsWith("- ") || next.startsWith("|")) break;
      paragraph.push(next);
      index += 1;
    }
    nodes.push(<p key={`paragraph-${index}`} className="text-sm leading-7 text-slate-700 sm:text-base">{paragraph.join(" ")}</p>);
  }

  return nodes;
}

export function LegalMarkdownPage({ documentName }: { documentName: string }) {
  if (!LEGAL_DOCUMENTS.has(documentName)) throw new Error("Unknown legal document");
  const markdown = readFileSync(join(process.cwd(), "legal-content", documentName), "utf8");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-4xl space-y-5 rounded-3xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        {renderMarkdown(markdown)}
      </article>
    </main>
  );
}
