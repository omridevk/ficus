import { FigmaOptions } from "@figus/figma";

export interface CliOptions {
    /**
     * where to save the output to
     */
    output?: string;
    /**
     * Which framework to generate components for
     */
    framework: "vue" | "react";
    /**
     * Figma config
     */
    figma?: FigmaOptions;
    /**
     * Path to svg if we only generate
     */
    path?: string;
}
