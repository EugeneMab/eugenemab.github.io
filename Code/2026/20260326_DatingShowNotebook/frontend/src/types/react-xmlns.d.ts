// Extend React HTML attributes to allow xmlns for SVG/XHTML export
declare namespace React {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    xmlns?: string;
  }
}
