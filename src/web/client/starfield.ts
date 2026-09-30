import { element } from "./dom";

export function initializeStarfield(): void {
  const field = element("starfield");
  const draw = (): void => {
    const bounds = field.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    field.setAttribute("viewBox", `0 0 ${width} ${height}`);
    field.setAttribute("preserveAspectRatio", "xMidYMid meet");
    field.replaceChildren();

    for (let index = 0; index < 54; index += 1) {
      const star = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const point = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      const horizontal = 12 + ((index * 137 + 29) % Math.max(24, width - 24));
      const vertical = 8 + ((index * 173 + 61) % Math.max(16, height - 16));

      star.setAttribute("class", `star star-phase-${index % 7}`);
      point.setAttribute("cx", String(horizontal));
      point.setAttribute("cy", String(vertical));
      point.setAttribute("r", index % 9 === 0 ? "1.7" : "1");
      star.append(point);

      if (index % 9 === 0) {
        const rays = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        rays.setAttribute(
          "d",
          `M${horizontal - 4} ${vertical}h8M${horizontal} ${vertical - 4}v8`,
        );
        rays.setAttribute("class", "star-rays");
        star.append(rays);
      }

      field.append(star);
    }
  };

  const updateVisibility = () => {
    field.classList.toggle("paused", document.hidden);
  };

  document.addEventListener("visibilitychange", updateVisibility);
  new ResizeObserver(draw).observe(field);
  draw();
  updateVisibility();
}
