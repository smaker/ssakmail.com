import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export const ssakmailTheme = defineTheme({
  name: "ssakmail",
  extends: neutralTheme,
  tokens: {
    "--color-accent": ["#285C31", "#6FBF73"],
  },
});
