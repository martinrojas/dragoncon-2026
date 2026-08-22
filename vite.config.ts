import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

export default defineConfig({
  plugins: [
    babel({
      presets: [reactCompilerPreset()],
    }),
    voidPlugin(),
    voidReact(),
  ],
});
