declare module 'markdown-it-plantuml/lib/deflate.js' {
  /**
   * Compress a string using the pure-JS DEFLATE implementation bundled with
   * markdown-it-plantuml (Masanao Izumo, 1999). Returns a binary string.
   * The second argument is the compression level (0–9).
   */
  export function zip_deflate(data: string, level: number): string;

  /**
   * Encode a binary string using PlantUML's URL-safe base64 variant
   * (described at http://plantuml.sourceforge.net/codejavascript2.html).
   */
  export function encode64(data: string): string;

  const _default: { zip_deflate: typeof zip_deflate; encode64: typeof encode64 };
  export default _default;
}
