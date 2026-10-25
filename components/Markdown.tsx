import { Fragment, type ReactNode } from "react";

/** Minimal, safe Markdown subset (headings, bullets, numbered lists, tables, **bold**, _italic_) rendered as React elements, never as HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|(?:^|(?<=\s))_[^_]+_(?=\s|$|[.,;:]))/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.length > 2 && part.startsWith("_") && part.endsWith("_") ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flushTable = () => {
    if (!table) return;
    const [head, ...body] = table;
    out.push(
      <div key={out.length} className="scroll">
        <table className="compact">
          <thead>
            <tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>{r.map((c, i) => <td key={i} className={/^-?[\d,.]+%?$/.test(c) ? "num" : undefined}>{inline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    table = null;
  };
  const flush = () => {
    flushTable();
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (list) {
        const l = list as { ordered: boolean; items: string[] };
        out.push(l.ordered ? <ol key={out.length}>{l.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</ol> : <ul key={out.length}>{l.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</ul>);
        list = null;
      }
      table = table ?? [];
      table.push(cells);
      continue;
    }
    flushTable();
    if (h) {
      flush();
      out.push(<h4 key={out.length}>{inline(h[1])}</h4>);
    } else if (ul || ol) {
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(<p key={out.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="md">{out}</div>;
}
