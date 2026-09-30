import { taskSummarySchema } from "../../tasks/viewSchema";
import { actionButton } from "./actions";
import { request } from "./api";
import { create, element } from "./dom";

export function initializeTaskList(): void {
  actionButton({
    id: "refresh-tasks",
    action: async () => {
      const tasks = await request({
        path: "/api/tasks",
        schema: taskSummarySchema,
      });
      const target = element("task-list");
      target.replaceChildren();
      if (tasks.length === 0)
        target.append(
          create({
            tag: "p",
            text: "No recorded work in this repository. Choose the shadowclone-work skill to begin in your coding agent.",
          }),
        );
      for (const task of tasks) {
        const item = create({ tag: "article" });
        item.append(create({ tag: "strong", text: task.title }));
        item.append(
          create({
            tag: "p",
            text: `${task.host} · ${task.state} · verification ${task.verification} · ${task.finish} finish line`,
          }),
        );
        item.append(
          create({ tag: "code", text: `shadowclone task status ${task.id}` }),
        );
        if (task.interruptedActions > 0)
          item.append(
            create({
              tag: "p",
              text: "An interrupted action needs reconciliation before work can continue.",
            }),
          );
        target.append(item);
      }
    },
  });
}
