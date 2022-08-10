import { FigmaOptions } from "@figus/figma";

export interface CliOptions {
    output?: string;
    framework: "vue" | "react";
    figma?: FigmaOptions;
    path?: string;
}
