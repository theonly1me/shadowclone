import { create, element } from "./dom";
import { editor, equipped } from "./state";
import { skillTitle } from "./presentation";

const identities = {
  craft: { title: "The Artisan", trait: "Thoughtful craft" },
  verification: {
    title: "The Investigator",
    trait: "Evidence before confidence",
  },
  autonomy: { title: "The Navigator", trait: "Deliberate decisions" },
};

export function renderIdentity(): void {
  const selected =
    editor.view?.items.filter(
      (item) => item.owner !== "provider" && equipped(item),
    ) ?? [];
  const branches = (["craft", "verification", "autonomy"] as const)
    .map((branch) => ({
      branch,
      count: selected.filter((item) => item.branch === branch).length,
    }))
    .sort((left, right) => right.count - left.count);
  const [strongest] = branches;
  const identity = strongest ? identities[strongest.branch] : identities.craft;

  element("equipped-count").textContent =
    `${selected.length} ${selected.length === 1 ? "skill" : "skills"} equipped${editor.dirty ? " · unsaved changes" : ""}`;
  element("identity-title").textContent = selected.length
    ? identity.title
    : "An open canvas";
  element("identity-description").textContent = selected.length
    ? `Your working style is shaped by ${selected
        .slice(0, 3)
        .map((item) => skillTitle(item).toLowerCase())
        .join(
          ", ",
        )}${selected.length > 3 ? `, and ${selected.length - 3} more equipped skills` : ""}.`
    : "Choose the instincts you want your agent to bring to work.";

  const traits = element("traits");

  traits.replaceChildren();

  for (const branch of branches.filter((entry) => entry.count > 0)) {
    traits.append(
      create({
        tag: "span",
        className: "trait",
        text: `${identities[branch.branch].trait} · ${branch.count}`,
      }),
    );
  }

  const requirements = element("requirements");

  requirements.replaceChildren();
  requirements.hidden = !editor.view?.requirements.length;

  if (editor.view?.requirements.length) {
    requirements.append(
      create({ tag: "h3", text: "◇ Repository requirements" }),
    );

    for (const requirement of editor.view.requirements) {
      requirements.append(create({ tag: "p", text: requirement }));
    }
  }
}
