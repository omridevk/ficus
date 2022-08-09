import { CliOptions } from "@figus/types";
import { FigmaOptions } from "@figus/figma";
import { resolve } from "pathe";
import fs from "fs-extra";
import { pathToFileURL } from "url";

export function defineConfig(config: CliOptions) {
    return config;
}

type Config = CliOptions & { figma: FigmaOptions };

const supportedConfigExtensions = ["js", "ts", "mjs", "mts"];

export async function resolveUserConfig(
    root: string = process.cwd()
): Promise<Config> {
    // load user config
    let configPath;
    for (const ext of supportedConfigExtensions) {
        const p = resolve(root, `ficus.config.${ext}`);
        if (await fs.pathExists(p)) {
            configPath = p;
            break;
        }
    }
    if (!configPath) {
        throw new Error("missing config");
    }
    return await loadConfigFile(configPath);
}

async function loadConfigFile(fileName: string): Promise<Config> {
    const config = (await import(pathToFileURL(fileName).href)).default;
    return config;
}
