import { marked } from 'marked';

/**
 * Notes and revision material come back as Markdown. Rendered here and
 * nowhere else, so there is one answer to what a heading looks like.
 *
 * The text is the lecturer's material, generated on our own server from our
 * own prompts and read back by a person before publication — but it is still
 * rendered as HTML, so anything that looks like a tag is escaped first. A
 * lecture about HTML would otherwise be able to write to this page.
 */
export function Markdown({ source }: { source: string }) {
  const escaped = source.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = marked.parse(escaped, { async: false, breaks: false }) as string;
  return <div className="prose-academic" dangerouslySetInnerHTML={{ __html: html }} />;
}
