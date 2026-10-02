import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

export const THEMES = [
  { id: "midnight", label: "Midnight" },
  { id: "light", label: "Clean Light" },
  { id: "sage", label: "Soft Sage" },
  { id: "slate", label: "Modern Slate" },
] as const;

const KEY = "edusync-theme";

export function applyStoredTheme() {
  const t = localStorage.getItem(KEY) ?? "midnight";
  document.documentElement.dataset.theme = t;
  return t;
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("midnight");
  useEffect(() => setTheme(applyStoredTheme()), []);
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <Palette className="h-4 w-4" aria-hidden />
      <span className="sr-only">Theme</span>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(e) => {
          localStorage.setItem(KEY, e.target.value);
          document.documentElement.dataset.theme = e.target.value;
          setTheme(e.target.value);
        }}
        className="rounded-md border bg-card px-2 py-1 text-foreground"
      >
        {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
    </label>
  );
}
