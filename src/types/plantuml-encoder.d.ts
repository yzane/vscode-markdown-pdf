declare module 'plantuml-encoder' {
  interface PlantumlEncoder {
    /**
     * Deflate + base64-encode a PlantUML source string into the URL-safe form
     * expected by PlantUML servers (e.g. http://www.plantuml.com/plantuml/svg/<encoded>).
     */
    encode(source: string): string;
    decode(encoded: string): string;
  }
  const plantumlEncoder: PlantumlEncoder;
  export = plantumlEncoder;
}
