import "./ExcalidrawLogo.scss";

// STRL: STRL-Ideate brand mark (a "spark of an idea" sparkle) + wordmark.
// Monochrome (currentColor) so it adapts to light/dark like the original.
// Keeps the .ExcalidrawLogo-icon / -text class names so the existing SCSS
// sizing applies unchanged. Only the welcome screen renders this.
const LogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    <path d="M15 5 L19 16 L30 20 L19 24 L15 35 L11 24 L0 20 L11 16 Z" />
    <path
      d="M32 2 L33.4 6.6 L38 8 L33.4 9.4 L32 14 L30.6 9.4 L26 8 L30.6 6.6 Z"
      opacity="0.9"
    />
  </svg>
);

const LogoText = () => (
  <svg
    viewBox="0 0 300 54"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-text"
  >
    <text
      x="0"
      y="41"
      fontFamily="Assistant, system-ui, -apple-system, sans-serif"
      fontSize="46"
      fontWeight={700}
    >
      STRL-Ideate
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};
