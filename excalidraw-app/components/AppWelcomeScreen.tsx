import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useEffect, useState } from "react";

const baseName = (p: string) =>
  p
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.excalidraw$/i, "") ?? p;

export const AppWelcomeScreen: React.FC = React.memo(() => {
  const { t } = useI18n();

  // STRL desktop: surface recent files as quick-open shortcuts on the start
  // screen. No-op on the web (window.strlDesktop is undefined).
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  useEffect(() => {
    const desktop = window.strlDesktop;
    if (!desktop) {
      return;
    }
    let active = true;
    void desktop.getRecentFiles().then((files) => {
      if (active) {
        setRecentFiles(files);
      }
    });
    const off = desktop.onRecentFiles((files) => setRecentFiles(files));
    return () => {
      active = false;
      off();
    };
  }, []);

  const headingContent = (
    <>
      {t("welcomeScreen.app.center_heading")}
      <br />
      {t("welcomeScreen.app.center_heading_line2")}
      <br />
      {t("welcomeScreen.app.center_heading_line3")}
    </>
  );

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {headingContent}
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          {window.strlDesktop &&
            recentFiles.slice(0, 5).map((filePath) => (
              <WelcomeScreen.Center.MenuItem
                key={filePath}
                title={filePath}
                onSelect={() => window.strlDesktop?.openRecent(filePath)}
              >
                {baseName(filePath)}
              </WelcomeScreen.Center.MenuItem>
            ))}
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
