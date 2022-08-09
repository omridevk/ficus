import nodeResolve from "@rollup/plugin-node-resolve";
import { builtinModules } from "module";
import pkg from "./package.json";
import path from "path";
import commonjs from "@rollup/plugin-commonjs";
import esbuild from "rollup-plugin-esbuild";
import json from "@rollup/plugin-json";
import alias from "@rollup/plugin-alias";

import { relative } from "pathe";

const entries = ["src/cli.ts", "src/config.ts"];

const external = [
    ...builtinModules,
    ...Object.keys(pkg.dependencies),
    "worker_threads",
    "inspector",
];

export default {
    input: entries,
    output: {
        dir: "dist",
        format: "esm",
        sourcemap: true,
        entryFileNames: "[name].mjs",
        chunkFileNames: (chunkInfo) => {
            const id =
                chunkInfo.facadeModuleId ||
                Object.keys(chunkInfo.modules).find(
                    (i) => !i.includes("node_modules") && i.includes("src/")
                );
            if (id) {
                const parts = Array.from(
                    new Set(
                        relative(process.cwd(), id)
                            .split(/\//g)
                            .map((i) => i.replace(/\..*$/, ""))
                            .filter(
                                (i) =>
                                    ![
                                        "src",
                                        "index",
                                        "dist",
                                        "node_modules",
                                    ].some((j) => i.includes(j)) &&
                                    i.match(/^[\w_-]+$/)
                            )
                    )
                );
                if (parts.length)
                    return `chunk-${parts.slice(-2).join("-")}.[hash].mjs`;
            }
            return "vendor-[name].[hash].mjs";
        },
    },
    external,
    plugins: [
        alias({
            entries: [
                {
                    find: "@figus/utils",
                    replacement: path.resolve(__dirname, "../utils/index.ts"),
                },
                {
                    find: "@figus/svg",
                    replacement: path.resolve(__dirname, "../svg/src/index.ts"),
                },
                {
                    find: "@figus/figma",
                    replacement: path.resolve(
                        __dirname,
                        "../figma/src/index.ts"
                    ),
                },
            ],
        }),
        nodeResolve({
            preferBuiltins: true,
        }),
        json(),
        commonjs(),
        esbuild({
            target: "node14",
        }),
    ],
};
