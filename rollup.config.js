import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import json from "@rollup/plugin-json";

const plugins = [typescript(), nodeResolve(), commonjs(), json()];

const external = [];

const name = "herokuappman";

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
          "MISSING_NODE_BUILTINS",
          "EVAL",
        ].includes(warning.code)
      )
        return;

      console.log(warning.code);

      warn(warning);
    },
  },
];
