import { readInstalledClone, runGh } from "@shadowclone/cloud";

export async function requestCloudReview(options: {
  readonly repository: string;
  readonly number: number;
}): Promise<void> {
  const { repository, number } = options;
  const token = (await runGh({ arguments: ["auth", "token"] })).trim();
  const clone = await readInstalledClone({ repository, token });

  if (clone === null) {
    throw new Error(`${repository} has no Shadowclone bot yet. Run shadowclone bot setup --bot <login> in its checkout, and then run shadowclone review ${number} --cloud again.`);
  }

  await runGh({ arguments: ["pr", "comment", String(number), "--repo", repository, "--body", `@${clone.botLogin} review`] });
  console.log(`Asked ${clone.botLogin} to review ${repository}#${number}. The review appears on the pull request when the workflow finishes.`);
}
