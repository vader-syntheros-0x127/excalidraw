import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";

// STRL: removed the "end-to-end encrypted" shield/link — STRL-Ideate is local-only
// (no collaboration), so the E2E-encryption claim and the plus.excalidraw.com link
// no longer apply. Footer keeps only the dev-only visual debugger toggle.
export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
        </div>
      </Footer>
    );
  },
);
