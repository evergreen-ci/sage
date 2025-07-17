// src/tools/base/Tool.ts

export abstract class Tool {
  name: string;
  description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  abstract execute(input: string, context?: unknown): Promise<unknown>;
}
