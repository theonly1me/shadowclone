type PinnedLinter = {
  readonly binary: string;
  readonly url: string;
  readonly sha256: string;
  readonly archive: "none" | "tar.gz" | "tar.xz";
  readonly pathInArchive: string;
};

export const reviewLinters: readonly PinnedLinter[] = [
  {
    binary: "shellcheck",
    url: "https://github.com/koalaman/shellcheck/releases/download/v0.10.0/shellcheck-v0.10.0.linux.x86_64.tar.xz",
    sha256: "6c881ab0698e4e6ea235245f22832860544f17ba386442fe7e9d629f8cbedf87",
    archive: "tar.xz",
    pathInArchive: "shellcheck-v0.10.0/shellcheck",
  },
  {
    binary: "hadolint",
    url: "https://github.com/hadolint/hadolint/releases/download/v2.15.1/hadolint-linux-x86_64",
    sha256: "c7187db94eeeeca956519a6af171adc31453941a1e777961f6e680f697c8c507",
    archive: "none",
    pathInArchive: "",
  },
  {
    binary: "actionlint",
    url: "https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz",
    sha256: "023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757",
    archive: "tar.gz",
    pathInArchive: "actionlint",
  },
  {
    binary: "zizmor",
    url: "https://github.com/zizmorcore/zizmor/releases/download/v1.30.1/zizmor-x86_64-unknown-linux-gnu.tar.gz",
    sha256: "e65324f4430c2717591937edcec90ccbefaf14c174f8ec9415e03ca875b46e1a",
    archive: "tar.gz",
    pathInArchive: "zizmor",
  },
  {
    binary: "squawk",
    url: "https://github.com/sbdchd/squawk/releases/download/v2.66.0/squawk-linux-x64",
    sha256: "e7965f8146b53cfa7a4625ceecfea5c6aeb35add39132210aa60b11ae180b9f4",
    archive: "none",
    pathInArchive: "",
  },
  {
    binary: "trivy",
    url: "https://github.com/aquasecurity/trivy/releases/download/v0.75.0/trivy_0.75.0_Linux-64bit.tar.gz",
    sha256: "c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f",
    archive: "tar.gz",
    pathInArchive: "trivy",
  },
];

export function linterInstallStep(): string {
  const installs = reviewLinters.map((linter) => `          install_linter ${linter.binary} '${linter.url}' ${linter.sha256} ${linter.archive} '${linter.pathInArchive}'`).join("\n");

  return `      - name: Install the pinned review linters
        continue-on-error: true
        working-directory: \${{ runner.temp }}
        run: |
          set -euo pipefail
          mkdir -p linters linter-downloads
          echo "$RUNNER_TEMP/linters" >> "$GITHUB_PATH"
          install_linter() {
            local download="linter-downloads/$1.download"
            curl -fsSL --retry 3 "$2" -o "$download"
            echo "$3  $download" | sha256sum --check --quiet
            case "$4" in
              none) install -m 0755 "$download" "linters/$1" ;;
              tar.gz) tar -xzf "$download" -C linter-downloads && install -m 0755 "linter-downloads/$5" "linters/$1" ;;
              tar.xz) tar -xJf "$download" -C linter-downloads && install -m 0755 "linter-downloads/$5" "linters/$1" ;;
            esac
          }
${installs}`;
}
