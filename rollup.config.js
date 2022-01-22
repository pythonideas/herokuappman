import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

const plugins = [typescript(), nodeResolve(), commonjs()];

const external = [];

const name = "appman";

export default [
  // Universal Module Definition, works as amd, cjs and iife all in one
  {
    input: "src/index.ts",
    external,
    output: {
      name,
      file: `dist/index.js`,
      format: "umd",
      sourcemap: true,
      exports: "named",
      globals: {},
      inlineDynamicImports: true,
    },
    plugins,
    onwarn(warning, warn) {
      if (
        [
          "CIRCULAR_DEPENDENCY",
          "UNRESOLVED_IMPORT",
          "MISSING_GLOBAL_NAME",
        ].includes(warning.code)
      )
        return;

      warn(warning);
    },
  },
];
