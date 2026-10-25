import { unzipSync } from "fflate";

export interface ArchiveEntry {
  name: string;
  bytes: Uint8Array;
}

const SKIP = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)|(^|\/)\./;
const MAX_FILES = 200;

/** Unpacks a .zip close pack into its files. Folders, OS metadata and nested archives one level deep are handled. */
export function unzipArchive(bytes: Uint8Array, depth = 0): ArchiveEntry[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("The archive could not be opened. Only standard .zip files are supported.");
  }
  const out: ArchiveEntry[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith("/") || SKIP.test(path) || data.length === 0) continue;
    const name = path.split("/").pop()!;
    if (/\.zip$/i.test(name) && depth === 0) out.push(...unzipArchive(data, 1).map((e) => ({ ...e, name: `${name.replace(/\.zip$/i, "")}/${e.name}` })));
    else out.push({ name, bytes: data });
    if (out.length > MAX_FILES) throw new Error(`The archive holds more than ${MAX_FILES} files.`);
  }
  return out;
}
