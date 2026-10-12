import {
  isMissingYoutubeThumbnail,
  youtubePlayerSrc,
  youtubeThumbnailSrc,
  youtubeVideoId,
} from "./youtube.js";

const PLAY_EVENT = "youtube-cover-play";
const ALLOW = "autoplay; encrypted-media; picture-in-picture; fullscreen";
const SVG_NS = "http://www.w3.org/2000/svg";

// The focus ring is a positioned ::after because the positioned thumbnail paints over the button's own outline.
const CSS = `
:host { display: block; position: relative; width: 100%; height: 100%; overflow: hidden; }
:host([hidden]) { display: none; }
button { all: unset; position: absolute; inset: 0; display: grid; place-items: center; cursor: pointer; }
button:focus-visible::after { content: ""; position: absolute; inset: 4px; border: 2px solid var(--youtube-cover-focus-color, #fff); border-radius: inherit; pointer-events: none; }
img, iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
img { object-fit: cover; }
.play { position: relative; display: grid; place-items: center;
  width: var(--youtube-cover-button-size, 56px); height: var(--youtube-cover-button-size, 56px);
  border-radius: var(--youtube-cover-button-radius, 9999px);
  background: var(--youtube-cover-button-bg, rgba(0, 0, 0, 0.6));
  -webkit-backdrop-filter: var(--youtube-cover-button-backdrop, none);
  backdrop-filter: var(--youtube-cover-button-backdrop, none);
  color: var(--youtube-cover-icon-color, #fff); }
.play svg { width: var(--youtube-cover-icon-size, 20px); height: var(--youtube-cover-icon-size, 20px); }
`;

const playIcon = (): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS(SVG_NS, "path");
  // The triangle sits right of centre so it looks centred in the round button.
  path.setAttribute("d", "M8 5v14l11-7z");
  svg.append(path);
  return svg;
};

export const defineYoutubeCover = (tagName = "youtube-cover"): void => {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;

  // Declared inside the function so that importing this module on the server never reads HTMLElement.
  class YoutubeCover extends HTMLElement {
    // Attribute-only, no url/label properties: React 19 then sets attributes, matching the server-rendered HTML.
    static observedAttributes = ["url", "label"];

    private readonly root: ShadowRoot;
    private button: HTMLButtonElement | null = null;
    private frame: HTMLIFrameElement | null = null;

    constructor() {
      super();
      const style = document.createElement("style");
      style.textContent = CSS;
      this.root = this.attachShadow({ mode: "open" });
      this.root.append(style);
    }

    connectedCallback(): void {
      document.addEventListener(PLAY_EVENT, this.handlePlayEvent);
      // Some upgrades skip attributeChangedCallback for attributes already present (happy-dom does).
      if (!this.button) this.render();
    }

    disconnectedCallback(): void {
      document.removeEventListener(PLAY_EVENT, this.handlePlayEvent);
    }

    attributeChangedCallback(name: string): void {
      if (name === "url") {
        this.render();
        return;
      }
      this.button?.setAttribute("aria-label", this.labelText());
      this.frame?.setAttribute("title", this.labelText());
    }

    private labelText(): string {
      return this.getAttribute("label") || "Play video";
    }

    private readonly handlePlayEvent = (event: Event): void => {
      // event.target is retargeted to a shadow host, so only the composed path says whether this cover sent it.
      if (this.frame && this.button && !event.composedPath().includes(this)) {
        this.frame.replaceWith(this.button);
        this.frame = null;
      }
    };

    private render(): void {
      this.button?.remove();
      this.frame?.remove();
      this.button = null;
      this.frame = null;

      const url = this.getAttribute("url");
      const id = youtubeVideoId(url);
      const thumbnail = youtubeThumbnailSrc(url);
      const fallback = youtubeThumbnailSrc(url, "hqdefault");
      const player = youtubePlayerSrc(url);
      if (!id || !thumbnail || !fallback || !player) return;

      const img = document.createElement("img");
      img.setAttribute("alt", "");
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("src", thumbnail);

      // A deleted video 404s on hqdefault too, so the swap happens at most once.
      let fellBack = false;
      const fallBack = (): void => {
        if (fellBack) return;
        fellBack = true;
        img.setAttribute("src", fallback);
      };
      img.addEventListener("error", fallBack);
      img.addEventListener("load", () => {
        if (isMissingYoutubeThumbnail(img)) fallBack();
      });

      const play = document.createElement("span");
      play.setAttribute("class", "play");
      play.setAttribute("aria-hidden", "true");
      play.append(playIcon());

      const button = document.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute("aria-label", this.labelText());
      button.append(img, play);
      button.addEventListener("click", () => {
        const frame = document.createElement("iframe");
        frame.setAttribute("src", player);
        frame.setAttribute("allow", ALLOW);
        frame.setAttribute("allowfullscreen", "");
        frame.setAttribute("title", this.labelText());
        button.replaceWith(frame);
        this.frame = frame;

        this.dispatchEvent(
          new CustomEvent(PLAY_EVENT, {
            bubbles: true,
            composed: true,
            detail: { id },
          }),
        );
        frame.focus({ preventScroll: true });
      });

      this.button = button;
      this.root.append(button);
    }
  }

  customElements.define(tagName, YoutubeCover);
};
