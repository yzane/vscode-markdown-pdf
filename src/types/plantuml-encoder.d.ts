declare module 'plantuml-encoder' {
  /**
   * Deflate + base64-encode a PlantUML source string into the URL-safe form
   * expected by PlantUML servers (e.g. http://www.plantuml.com/plantuml/svg/<encoded>).
   */
  export function encode(source: string): string;

  const _default: { encode: typeof encode };
  export default _default;
}
