/**
 * Renders one hand-written homepage block.
 *
 * The HTML has already been through sanitize-html on the way into the database
 * and again on the way out (src/lib/blocks-server.ts), which is what makes
 * dangerouslySetInnerHTML acceptable here. Nothing else in the app renders
 * stored HTML, and nothing should start without the same treatment.
 */
export function HtmlBlock({ html, invert, className = "" }: { html: string; invert?: boolean; className?: string }) {
  return <div className={`rich ${invert ? "rich-invert" : ""} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
