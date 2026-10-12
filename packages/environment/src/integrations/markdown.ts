import { fingerprint } from "@shadowclone/core";
import { preservedFileMessages } from "./preserved";

export type SectionMarkers = { readonly start: string; readonly end: string };

export const managedStart = "\n\n<shadowclone-guidance>";
export const managedEnd = "</shadowclone-guidance>\n";
export const guidanceMarkers: SectionMarkers = {
  start: managedStart,
  end: managedEnd,
};
export const harnessMarkers: SectionMarkers = {
  start: "\n\n<!-- shadowclone-harness:start -->",
  end: "<!-- shadowclone-harness:end -->\n",
};

export function markedSection(options: {
  readonly text: string;
  readonly markers: SectionMarkers;
}): string | null {
  const { text, markers } = options;
  const start = text.indexOf(markers.start);
  const end = text.indexOf(markers.end);

  if (start < 0 && end < 0) {
    return null;
  }

  if (
    start < 0 ||
    end < start ||
    text.indexOf(markers.start, start + markers.start.length) >= 0 ||
    text.indexOf(markers.end, end + markers.end.length) >= 0
  ) {
    throw new Error(
      "Malformed shadowclone managed section; review the destination",
    );
  }

  return text.slice(start, end + markers.end.length);
}

export function managedSection(text: string): string | null {
  return markedSection({ text, markers: guidanceMarkers });
}

export function stripManagedGuidance(text: string): string {
  const section = managedSection(text);

  return section === null ? text : text.replace(section, "");
}

const guidanceOpen = "<shadowclone-guidance>";
const guidanceClose = "</shadowclone-guidance>";

export function stripEveryManagedSection(text: string): string | null {
  const kept: string[] = [];
  let position = 0;

  for (let start = text.indexOf(guidanceOpen); start >= 0; start = text.indexOf(guidanceOpen, position)) {
    const end = text.indexOf(guidanceClose, start + guidanceOpen.length);

    if (end < 0) {
      return null;
    }

    kept.push(text.slice(position, start));
    position = end + guidanceClose.length + (text[end + guidanceClose.length] === "\n" ? 1 : 0);
  }

  const stripped = `${kept.join("")}${text.slice(position)}`;

  return stripped.includes(guidanceClose) ? null : stripped;
}

export function stripHarnessSection(text: string): string {
  const section = markedSection({ text, markers: harnessMarkers });

  return section === null ? text : text.replace(section, "");
}

export function updateMarkedSection(options: {
  readonly previous: string | null;
  readonly body: string | null;
  readonly expected?: string;
  readonly markers: SectionMarkers;
}): { readonly text: string; readonly fingerprint: string } {
  const previous = options.previous ?? "";
  const section = markedSection({ text: previous, markers: options.markers });

  const recordedEmpty = options.expected === fingerprint("") && section === null;

  if (
    options.expected !== undefined &&
    !recordedEmpty &&
    (!section || fingerprint(section) !== options.expected)
  ) {
    throw new Error(preservedFileMessages.editedManagedContent);
  }

  if (section && options.expected === undefined) {
    throw new Error(preservedFileMessages.untrackedManagedContent);
  }

  const next =
    options.body === null
      ? ""
      : `${options.markers.start}\n${options.body.trim()}\n${options.markers.end}`;
  const text = section ? previous.replace(section, next) : `${previous}${next}`;

  return { text, fingerprint: fingerprint(next) };
}

export function updateManagedSection(options: {
  readonly previous: string | null;
  readonly body: string | null;
  readonly expected?: string;
}): { readonly text: string; readonly fingerprint: string } {
  return updateMarkedSection({ ...options, markers: guidanceMarkers });
}
