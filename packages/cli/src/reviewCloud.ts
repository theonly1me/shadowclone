import { createReviewUpdatePull, githubApi, readInstalledClone, runGh } from "@shadowclone/cloud";

export async function requestCloudReview(options: {
  readonly repository: string;
  readonly number: number;
}): Promise<void> {
  const { repository, number } = options;
  const token = (await runGh({ arguments: ["auth", "token"] })).trim();
  const installed = await readInstalledClone({ repository, token });

  if (installed === null) {
    throw new Error(`${repository} has no Shadowclone bot yet. Run shadowclone bot setup --bot <login> in its checkout, and then run shadowclone review ${number} --cloud again.`);
  }

  if (!installed.hasReview) {
    const url = await createReviewUpdatePull({ clone: installed.clone, token, api: githubApi });

    console.log(`The clone's workflows cannot review yet. Merge ${url}, and then run shadowclone review ${number} --cloud again.`);
    return;
  }

  await runGh({ arguments: ["pr", "comment", String(number), "--repo", repository, "--body", `@${installed.clone.botLogin} review`] });
  console.log(`Asked ${installed.clone.botLogin} to review ${repository}#${number}. The review appears on the pull request when the workflow finishes.`);
}
