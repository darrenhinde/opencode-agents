import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import { ContextDefinitionSchema, type ContextDefinition, type LoadedContext } from './types.js';

export interface DiscoveryOptions {
  rootDir?: string;
  contextDir?: string;
}

export class ContextDiscovery {
  private rootDir: string;
  private contextDir: string;

  constructor(options: DiscoveryOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.contextDir = options.contextDir || path.join(this.rootDir, '.opencode', 'context');
  }

  async discover(): Promise<ContextDefinition[]> {
    const files = await glob('**/*.{yaml,yml,json}', {
      cwd: this.contextDir,
      ignore: ['node_modules/**'],
    });

    const definitions: ContextDefinition[] = [];

    for (const file of files) {
      const filePath = path.join(this.contextDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = file.endsWith('.json') ? JSON.parse(content) : parseYaml(content);
        
        // Handle array of definitions or single definition
        const items = Array.isArray(parsed) ? parsed : [parsed];
        
        for (const item of items) {
          const result = ContextDefinitionSchema.safeParse(item);
          if (result.success) {
            definitions.push(result.data);
          } else {
            console.warn(`Invalid context definition in ${file}:`, result.error.format());
          }
        }
      } catch (error) {
        console.warn(`Failed to load context file ${file}:`, error);
      }
    }

    return definitions;
  }

  async loadContext(definition: ContextDefinition): Promise<LoadedContext | null> {
    if (definition.type === 'file') {
      const filePath = path.resolve(this.rootDir, definition.path);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          definition,
          content,
          source: filePath,
        };
      } catch (error) {
        console.warn(`Failed to read context file ${definition.path}:`, error);
        return null;
      }
    }
    // TODO: Handle URL and API types
    return null;
  }
}
