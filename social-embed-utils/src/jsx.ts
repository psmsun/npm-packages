// A namespace import: tsc's declaration emit rejects named imports used inside the augmentation (TS4033).
import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "youtube-cover": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        url?: string;
        label?: string;
        cover?: string;
      };
    }
  }
}

export {};
