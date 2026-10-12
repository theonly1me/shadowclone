import type { Clone } from "./types";

type IdentityPins = {
  readonly checkout: string;
  readonly script: string;
};

export const botToken = `\${{ secrets.SHADOWCLONE_BOT_TOKEN }}`;

function condition(when: string | null): string {
  return when === null ? "" : `\n        if: ${when}`;
}

export function botTokenSteps(options: {
  readonly clone: Clone;
  readonly pins: IdentityPins;
  readonly when: string | null;
}): string {
  const { clone, pins } = options;

  return `      - uses: ${pins.script}
        name: Accept the repository invitation as ${clone.botLogin}${condition(options.when)}
        with:
          github-token: ${botToken}
          script: |
            const invitations = await github.paginate('GET /user/repository_invitations');

            for (const invitation of invitations) {
              if (invitation.repository && invitation.repository.id === ${clone.repositoryId}) {
                await github.request('PATCH /user/repository_invitations/{invitation_id}', { invitation_id: invitation.id });
              }
            }`;
}

export function skillsSteps(options: {
  readonly clone: Clone;
  readonly pins: IdentityPins;
  readonly when: string;
}): string {
  return `      - uses: ${options.pins.checkout}${condition(options.when)}
        with:
          repository: '${options.clone.skillsRepository}'
          ssh-key: \${{ secrets.SHADOWCLONE_SKILLS_KEY }}
          path: .shadowclone-skills
          persist-credentials: false
      - name: Move the reviewed skills out of the work tree${condition(options.when)}
        run: |
          mv "$GITHUB_WORKSPACE/.shadowclone-skills" "$RUNNER_TEMP/shadowclone-guidance"
          rm -rf "$RUNNER_TEMP/shadowclone-guidance/.git"
          echo "SHADOWCLONE_GUIDANCE_DIRECTORY=$RUNNER_TEMP/shadowclone-guidance" >> "$GITHUB_ENV"`;
}
