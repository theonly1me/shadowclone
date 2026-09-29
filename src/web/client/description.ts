import {
  descriptionResultSchema,
  descriptionReviewSchema,
  type BuildDescription,
} from "../descriptionProtocol";
import { request } from "./api";
import { create, element } from "./dom";
import { showGenerationReview } from "./generationDialog";
import { editor } from "./state";
import { refreshTree } from "./tree";

let describedInput: string | null = null;
let description: BuildDescription | null = null;

export function renderModelDescription(): void {
  const container = element("model-description");

  container.replaceChildren();

  if (!description || describedInput !== JSON.stringify(editor.input)) {
    return;
  }

  container.append(
    create({ tag: "h3", text: description.title }),
    create({ tag: "p", text: description.summary }),
  );

  for (const strength of description.strengths) {
    container.append(create({ tag: "p", text: `Strength: ${strength}` }));
  }

  for (const tradeoff of description.tradeoffs) {
    container.append(create({ tag: "p", text: `Tradeoff: ${tradeoff}` }));
  }
}

export async function reviewDescription(): Promise<void> {
  const input = JSON.stringify(editor.input);
  const review = await request({
    path: "/api/description/preview",
    schema: descriptionReviewSchema,
    body: editor.input,
  });

  showGenerationReview({
    review,
    title: "Describe your agent.",
    explanation:
      "An interpretation of your selected guidance. It does not change your skills or add personality instructions.",
    confirm: "Send and describe",
    path: "/api/description/generate",
    schema: descriptionResultSchema,
    accept: (result) => {
      description = result.description;
      describedInput = input;

      for (const label of result.description.hubLabels) {
        const hub = editor.view?.constellation.hubs.find(
          (candidate) => candidate.id === label.id,
        );

        if (hub) hub.title = label.title;
      }

      refreshTree();
      renderModelDescription();
    },
  });
}
