const upstreamThreadLink = /https?:\/\/github\.com\/vitejs\/[\w.-]+\/(?:issues|pull|discussions)\/\d+(?:[/?#][^\s)\]]*)?/g;
const crossRepositoryReference = /\b[\w.-]+\/[\w.-]+#\d+/g;
const issueReference = /(^|[^\w&/])#(\d+)\b/g;
const mention = /(^|[^\w`])@([A-Za-z0-9][A-Za-z0-9-]*)/g;
const htmlComment = /<!--[\s\S]*?-->/g;

export function sanitizeBody(body: string): string {
  return body
    .replace(htmlComment, "")
    .replace(upstreamThreadLink, "(upstream link removed)")
    .replace(crossRepositoryReference, "(upstream reference removed)")
    .replace(issueReference, "$1upstream issue $2")
    .replace(mention, "$1$2")
    .trim()
    .slice(0, 20_000);
}
