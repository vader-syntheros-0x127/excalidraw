// STRL: file I/O for the MCP server. Every target is resolved under
// STRL_MCP_WORKDIR with a path-traversal guard + `.excalidraw` extension + 50 MB
// cap (mirrors desktop/src/main.ts openFilePath). Writes are atomic (temp +
// rename) so a desktop file-watcher only ever sees a complete file.
import fs from "node:fs";
import path from "node:path";

import {
  createScene,
  parseSceneFile,
  serializeScene,
} from "@strl/authoring";

import type { AuthoringScene } from "@strl/authoring";

export const MAX_SCENE_BYTES = 50 * 1024 * 1024;

export const getWorkdir = (): string => {
  const workdir = process.env.STRL_MCP_WORKDIR;
  if (!workdir) {
    throw new Error(
      "STRL_MCP_WORKDIR is not set — refusing to read/write without a sandbox root",
    );
  }
  return path.resolve(workdir);
};

/** Resolve a target `.excalidraw` path, rejecting anything outside the workdir. */
export const resolveTarget = (fileArg?: string): string => {
  const workdir = getWorkdir();
  const candidate =
    fileArg ?? process.env.STRL_MCP_ACTIVE_FILE ?? "scene.excalidraw";
  const resolved = path.resolve(workdir, candidate);
  const rel = path.relative(workdir, resolved);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Target escapes STRL_MCP_WORKDIR: ${candidate}`);
  }
  if (!resolved.toLowerCase().endsWith(".excalidraw")) {
    throw new Error("Target must be a .excalidraw file");
  }
  return resolved;
};

/** Resolve + read any file under the workdir (used for image sources). */
export const resolveUnderWorkdir = (fileArg: string): string => {
  const workdir = getWorkdir();
  const resolved = path.resolve(workdir, fileArg);
  const rel = path.relative(workdir, resolved);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Path escapes STRL_MCP_WORKDIR: ${fileArg}`);
  }
  return resolved;
};

/** Load a scene from disk, or an empty scene if the file does not exist. */
export const loadOrEmpty = (target: string): AuthoringScene => {
  if (!fs.existsSync(target)) {
    return createScene();
  }
  const stat = fs.statSync(target);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${target}`);
  }
  if (stat.size > MAX_SCENE_BYTES) {
    throw new Error(`Scene exceeds ${MAX_SCENE_BYTES} bytes`);
  }
  return parseSceneFile(fs.readFileSync(target, "utf8"));
};

/** Load a scene that must already exist. */
export const loadExisting = (target: string): AuthoringScene => {
  if (!fs.existsSync(target)) {
    throw new Error(`No scene at ${path.basename(target)}`);
  }
  return loadOrEmpty(target);
};

/** Serialize + write a scene atomically (temp file + rename). */
export const writeSceneAtomic = (
  target: string,
  scene: AuthoringScene,
): { bytes: number } => {
  const json = serializeScene(scene);
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_SCENE_BYTES) {
    throw new Error(`Serialized scene exceeds ${MAX_SCENE_BYTES} bytes`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.strl-${process.pid}-${Date.now().toString(36)}.tmp`;
  fs.writeFileSync(tmp, json, "utf8");
  fs.renameSync(tmp, target);
  return { bytes };
};
