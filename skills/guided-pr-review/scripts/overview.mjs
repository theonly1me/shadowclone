import { escapeHtml, markdown } from "./format.mjs";

const overviewTitle = "What this change does";

const overviewSections = [
  { key: "problem", title: "The problem" },
  { key: "outcome", title: "What changes" },
  { key: "approach", title: "How it works" },
];

const hasText = (value) => typeof value === "string" && value.trim() !== "";

const pullsWithRoles = (pulls) => (pulls.length > 1 ? pulls : []);

export function checkOverview(input) {
  const terms = input.overview?.terms ?? [];
  if (!Array.isArray(terms)) throw new Error("overview.terms must be a list.");
  const missing = [
    ...overviewSections
      .filter((section) => !hasText(input.overview?.[section.key]))
      .map((section) => "overview." + section.key),
    ...pullsWithRoles(input.pulls)
      .filter((pull) => !hasText(pull.role))
      .map((pull) => "the role of PR #" + pull.number),
    ...terms
      .filter((entry) => !hasText(entry?.term) || !hasText(entry?.meaning))
      .map(() => "each term and its meaning"),
  ];
  if (missing.length)
    throw new Error("The overview needs text for " + [...new Set(missing)].join(", ") + ".");
}

function passageMarkup(options) {
  const anchor = "overview:" + options.key;
  return `<${options.element} class="passage" data-anchor="${anchor}" data-prs="${options.prs}">${options.heading}${options.body}<div class="inline-notes" data-notes-at="${anchor}"></div></${options.element}>`;
}

export function overviewRouteMarkup(review) {
  const pullCount = review.pulls.length === 1 ? "1 PR" : review.pulls.length + " PRs";
  return `<button class="route-step" data-step="0" type="button"><span>0</span><span>${overviewTitle}<small>Start here · ${pullCount}</small></span></button>`;
}

export function overviewMarkup(review) {
  const allPulls = review.pulls.map((pull) => pull.id).join(",");
  const sections = overviewSections.map((section) =>
    passageMarkup({
      element: "section",
      key: section.key,
      prs: allPulls,
      heading: "<h3>" + section.title + "</h3>",
      body: markdown(review.overview[section.key]),
    }),
  );
  const roles = pullsWithRoles(review.pulls).map((pull) =>
    passageMarkup({
      element: "li",
      key: pull.id,
      prs: pull.id,
      heading: `<p><a href="${escapeHtml(pull.url)}" target="_blank" rel="noreferrer">#${pull.number}</a> <strong>${escapeHtml(pull.title)}</strong></p>`,
      body: markdown(pull.role),
    }),
  );
  const terms = (review.overview.terms ?? []).map(
    (entry) => "<dt>" + escapeHtml(entry.term) + "</dt><dd>" + markdown(entry.meaning) + "</dd>",
  );
  const rolesMarkup = roles.length
    ? '<h3>What each PR adds</h3><ol class="pr-roles">' + roles.join("") + "</ol>"
    : "";
  const termsMarkup = terms.length
    ? passageMarkup({
        element: "section",
        key: "terms",
        prs: allPulls,
        heading: "<h3>Terms</h3>",
        body: '<dl class="terms">' + terms.join("") + "</dl>",
      })
    : "";
  return `<article class="reading-step overview-page" id="step-overview"><div class="step-meta"><span>Start here, then ${review.groups.length} reading steps</span></div><h1>${overviewTitle}</h1>${sections.join("")}${rolesMarkup}${termsMarkup}</article>`;
}
