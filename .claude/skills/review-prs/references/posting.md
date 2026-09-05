# Staging a PENDING review

Only after the maintainer approves the findings in chat. It is easy to publish by accident,
so follow this exactly.

## What makes a review pending

`POST /repos/{owner}/{repo}/pulls/{number}/reviews` creates a PENDING review when
the payload has **no `event` key and no `body` key**. Adding either publishes it.
There is no "draft: true" flag, the absence of those two keys is the mechanism.

Stage inline comments only, so the body stays absent rather than empty.

## Find the anchor lines

Anchor against the pinned head, not your local tree.

```bash
git show "${REF}:path/to/file.ts" | cat -n | sed -n '90,170p'
```

Only lines present in the diff can be anchored. For a file the PR adds, every
line qualifies and the diff position equals the line number, which is why
`position` in the response can be read directly as a line number for new files.

A multi-line anchor needs all four of `start_line`, `line`, `side`, and
`start_side`. A single-line anchor needs `line` and `side`.

## Build and validate the payload

Write to an absolute path and pass that same absolute path, so a sandboxed and an
unsandboxed process are looking at the same file.

```bash
cat > "$TMPDIR/review.json" <<'PAYLOAD'
{
  "commit_id": "<pinned head SHA>",
  "comments": [
    { "path": "src/collector.ts", "line": 25, "side": "RIGHT", "body": "..." },
    { "path": "src/redact.ts", "start_line": 19, "line": 21, "side": "RIGHT", "start_side": "RIGHT", "body": "..." }
  ]
}
PAYLOAD

python3 -c "
import json, os
d = json.load(open(os.environ['TMPDIR'] + '/review.json'))
print('comments:', len(d['comments']))
print('has event:', 'event' in d)
print('has body:', 'body' in d)
"
```

Both `has event` and `has body` must print `False`. If either prints `True`, fix it
before posting.

Body text is JSON, so backticks are safe but a literal `"` inside a comment needs
escaping. A heredoc quoted as `<<'PAYLOAD'` stops the shell touching anything.

## Post it

```bash
gh api --method POST repos/<owner>/<repo>/pulls/<number>/reviews \
  --input "$TMPDIR/review.json"
```

`gh` sometimes needs the sandbox disabled, because the GitHub API can fail with a TLS
certificate error inside it.

## Verify, every time

```bash
# state must be PENDING and the body must be empty
gh api repos/<owner>/<repo>/pulls/<number>/reviews/<review_id> \
  --jq '"\(.state) body_len=\(.body|length)"'

# count, anchors, and that nothing is a thread reply
gh api repos/<owner>/<repo>/pulls/<number>/reviews/<review_id>/comments --paginate \
  --jq '.[] | "pos=\(.position) reply_to=\(.in_reply_to_id // "-") | \(.body | split("\n")[0][0:60])"'
```

Check four things: `state` is `PENDING`, body length is 0, the comment count
matches what was approved, and every `in_reply_to_id` is absent. A populated
`in_reply_to_id` means you replied to someone's thread, which is never wanted.

## Reading pending comments back

Pending comments behave differently from published ones and this will confuse you
if you are not expecting it.

- `GET /repos/{owner}/{repo}/pulls/comments/{comment_id}` returns **404** for a
  comment inside a pending review. Use
  `GET /repos/{owner}/{repo}/pulls/{number}/reviews/{review_id}/comments` instead.
- On that endpoint, `line`, `start_line`, and `side` come back `null` for pending
  comments. `position` carries the anchor, so filter and verify on `position`.
- `GET /repos/{owner}/{repo}/pulls/{number}/comments` lists published comments
  only, so it will not show your staged ones. That is also the query to use when
  counting already-published comments to confirm nothing leaked out.

## Verify a multi-line anchor with GraphQL

REST returning `null` does not mean the range was lost, but it also cannot prove
the range survived. GraphQL shows the real anchors, so use it whenever a comment
used `start_line`.

```bash
gh api graphql -f query='
{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <number>) {
      reviews(states: PENDING, first: 5) {
        nodes { id comments(first: 50) { nodes { path startLine line } } }
      }
    }
  }
}'
```

This matters most when a comment carries a ` ```suggestion ` block, which is worth
including where the fix is a literal replacement of the anchored range. A
multi-line suggestion whose range silently collapsed to one line would commit
broken code when someone clicks apply.

## Editing a comment already staged

Because the single-comment GET returns 404 while a review is pending, treat
`PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}` as unverified for
pending comments. Do not assume it works.

What is known to work: give the corrected text in chat and let the maintainer paste it
over the comment in the GitHub UI. They often rewrite the wording anyway, and this
keeps them in control of what goes out under their name. Offer the patch only if asked,
and verify the result on the review comments endpoint afterward.

## Never

- Never send `event`, in any value. `COMMENT`, `APPROVE`, and `REQUEST_CHANGES`
  all publish.
- Never send a top-level `body`.
- Never `gh pr review`, `gh pr comment`, or `gh api ... /comments/{id}/replies`.
- Never reply to an existing thread, including a bot's.
- Never stage a comment the maintainer has not read in chat.
- Never leave a stale review pending without telling them the id.
