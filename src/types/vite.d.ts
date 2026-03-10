// Type declarations for YAML imports (via @modyfi/vite-plugin-yaml)

// Specific type for publicProjects.yaml
declare module '*/publicProjects.yaml' {
  const content: { projects: string[] };
  export default content;
}

// Generic fallback for other YAML files
declare module '*.yaml' {
  const content: Record<string, unknown>;
  export default content;
}

declare module '*.yml' {
  const content: Record<string, unknown>;
  export default content;
}
