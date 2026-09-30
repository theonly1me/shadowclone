import { expect, test } from "bun:test";
import { skillClassification } from "./classification";

test("reads nested portable skill classification", () => {
  const document = [
    "---",
    "name: synthetic-skill",
    "description: Synthetic guidance.",
    "metadata:",
    "  shadowclone-category: testing",
    "  shadowclone-section: workflow",
    "  shadowclone-axis: testing-approach",
    "---",
    "Synthetic instructions.",
  ].join("\n");

  expect(skillClassification(document)).toEqual({
    category: "testing",
    section: "workflow",
    axis: "testing-approach",
  });
});
