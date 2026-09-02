import { z } from "zod";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";

export const OacPreferencesSchema = z.object({
  yoloMode: z.boolean(),
  autoBackup: z.boolean(),
});
export const OacConfigSchema = z.object({
  version: z.literal("1"),
  preferences: OacPreferencesSchema,
});

export type OacPreferences = z.infer<typeof OacPreferencesSchema>;
export type OacConfig = z.infer<typeof OacConfigSchema>;

export const getConfigPath = (projectRoot: string): string =>
  join(projectRoot, ".oac", "config.json");

export const createDefaultConfig = (): OacConfig => ({
  version: "1",
  preferences: { yoloMode: false, autoBackup: true },
});

// Pure — returns new object, no mutation
export const mergeConfig = (base: OacConfig, overrides: Partial<OacPreferences>): OacConfig =>
  ({ ...base, preferences: { ...base.preferences, ...overrides } });

export const isYoloMode = (config: OacConfig): boolean =>
  config.preferences.yoloMode || process.env["CI"] === "true";

export const isAutoBackup = (config: OacConfig): boolean =>
  config.preferences.autoBackup;

export async function readConfig(projectRoot: string): Promise<OacConfig | null> {
  const configPath = getConfigPath(projectRoot);
  const exists = await stat(configPath).then((s) => s.isFile()).catch(() => false);
  if (!exists) return null;
  const raw = JSON.parse(await readFile(configPath, "utf8")) as unknown;
  const result = OacConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config at "${configPath}": ${result.error.message}`);
  }
  return result.data;
}

export async function writeConfig(projectRoot: string, config: OacConfig): Promise<void> {
  const configPath = getConfigPath(projectRoot);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
}
