import { FigmaOptions } from "@figus/figma";

export interface CliOptions {
    output: string;
    framework: "vue" | "react";
    disableLog?: boolean;
    figma?: FigmaOptions;
}
