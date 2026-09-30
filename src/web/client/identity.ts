import { constellationIdentity } from "../../builds/constellationIdentity";
import { create, element } from "./dom";
import { editor, equipped } from "./state";
import { skillTitle } from "./presentation";

export function renderIdentity(): void {
  const selected =
    editor.view?.items.filter(
      (item) => item.owner !== "provider" && equipped(item),
    ) ?? [];
  const identity = editor.view
    ? constellationIdentity({
        constellation: editor.view.constellation,
        selectedItemIds: new Set(selected.map((item) => item.id)),
      })
    : null;

  element("equipped-count").textContent =
    `${selected.length} ${selected.length === 1 ? "skill" : "skills"} equipped${editor.dirty ? " · unsaved changes" : ""}`;
  element("identity-title").textContent = identity?.title ?? "An open canvas";
  element("identity-description").textContent = identity
    ? `Your working style is shaped by ${selected
        .slice(0, 3)
        .map((item) => skillTitle(item).toLowerCase())
        .join(", ")}${selected.length > 3 ? `, and ${selected.length - 3} more equipped skills` : ""}.`
    : "Choose the instincts you want your agent to bring to work.";

  const traits = element("traits");
  traits.replaceChildren();

  for (const trait of identity?.traits ?? []) {
    traits.append(
      create({
        tag: "span",
        className: "trait",
        text: `${trait.title} · ${trait.count}`,
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
