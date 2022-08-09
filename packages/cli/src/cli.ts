import fse from "fs-extra";
import path, { ParsedPath } from "path";
import rimraf from "rimraf";
import Mustache from "mustache";
import Queue from "./waterfall/Queue";
import renameFilterDefault from "./rename-filters";
import { getComponentName } from "./utils/getComponentName";
import { formatFile, divider } from "@ficus/utils";
import { cleanPaths, getSvgs } from "@ficus/svg";
import cac from "cac";
import c from "picocolors";
import { version } from "../../../package.json";
import { CliOptions, Frameworks } from "@ficus/types";
import { download, FigmaOptions } from "@ficus/figma";
import { spinner } from "../../utils";
import fs from "fs";
import { resolveUserConfig } from "./config";

type RenameFilter = (
    svgPathObj: ParsedPath,
    innerPath: string,
    options: CliOptions & { svgDir: string }
) => string;

interface WorkerOptions {
    svgPath: string;
    svgDir: string;
    framework: Frameworks;
    output: string;
    renameFilter: RenameFilter;
    template: string;
    progress?: () => void;
}

async function worker({
    progress,
    svgPath,
    svgDir,
    output,
    renameFilter,
    framework,
    template,
}: WorkerOptions) {
    spinner.text = "Generating icons";
    await writeSvg({
        svgPath,
        svgDir,
        output,
        renameFilter,
        template,
        framework,
    });
}

export async function writeSvg({
    svgPath,
    svgDir,
    output,
    renameFilter,
    framework,
    template,
}: WorkerOptions) {
    const normalizedSvgPath = path.normalize(svgPath);
    const svgPathObj = path.parse(normalizedSvgPath);
    const innerPath = path
        .dirname(normalizedSvgPath)
        .replace(svgDir, "")
        .replace(path.relative(process.cwd(), svgDir), ""); // for relative dirs
    const destPath = renameFilter(svgPathObj, innerPath, {
        svgDir,
        output,
        framework,
    });
    const outputFileDir = path.dirname(path.join(output, destPath));
    await fse.ensureDir(outputFileDir);
    try {
        const data = await fse.readFile(svgPath, { encoding: "utf8" });
        const paths = cleanPaths({ svgPath, data });
        const componentName = getComponentName(destPath);

        const fileString = Mustache.render(template, {
            paths,
            componentName,
        });

        const absDestPath = path.join(output, destPath);
        await fse.writeFile(absDestPath, fileString);
        await formatFile(absDestPath);
    } catch (e) {
        return null;
    }
}

function getTemplate({ framework }: { framework: Frameworks }) {
    if (framework === "vue") {
        return `../../vue/templateSvgIcon.js.mustache`;
    }
    return `../../react/templateSvgIcon.js.mustache`;
}

export async function handler({
    output,
    disableLog,
    framework,
    svgDir,
    renameFilter,
}: CliOptions & { renameFilter: RenameFilter; svgDir: string }) {
    rimraf.sync(`${output}/*.vue`); // Clean old files

    if (typeof renameFilter !== "function") {
        throw Error("renameFilter must be a function");
    }
    await fse.ensureDir(output);
    const templatePath = getTemplate({ framework });
    const { svgPaths, template } = await getSvgs({ templatePath, svgDir });

    const queue = new Queue(
        (svgPath: string) =>
            worker({
                svgPath,
                svgDir,
                framework,
                output,
                renameFilter,
                template,
            }),
        { concurrency: 8 }
    );

    queue.push(svgPaths);
    await queue.wait({ empty: true });
    spinner.succeed("Done!!");
}

async function downloadFigma({
    pageName,
    imageKey,
    fileKey,
    output,
    token,
}: FigmaOptions) {
    if (!token) {
        console.log(`Please provide a ${c.red("Figma")} token`);
        return;
    }
    const svgDir = await download({
        token,
        path: output,
        figma: {
            pageName,
            imageKey,
            fileKey,
        },
    });
}

async function start(
    framework: Frameworks,
    {
        output,
        disableLog,
        token,
        imageKey,
        fileKey,
        pageName,
    }: CliOptions & FigmaOptions
) {
    try {
        const config = await resolveUserConfig();

        if (!token) {
            return;
        }
        const svgDir = await download({
            token,
            figma: {
                pageName,
                imageKey,
                fileKey,
            },
        });
        if (!svgDir) {
            console.error("Unable to download icons from figma");
            process.exit();
        }
        // download from figma
        const renameFilter = renameFilterDefault;
        // determine which framework (vue, react, angular)
        // use assets to create components
        await handler({
            svgDir,
            output,
            disableLog,
            renameFilter,
            framework,
        });
        fs.rmSync(svgDir, { recursive: true, force: true });
        process.exit();
    } catch (e) {
        process.exitCode = 1;
        console.error(
            `\n${c.red(divider(c.bold(c.inverse(" Unhandled Error "))))}`
        );
        console.error(e);
        console.error("\n\n");
    }
}

const cli = cac("ficus");

cli.version(version)
    .option("-s, --svg-dir <svgDir>", "Output of downloaded files")
    .option("-fk, --file-key <fileKey>", "figma file key")
    .option("-ik, --image-key <imageKey>", "figma image key")
    .option("-p, --page-name <pageName>", "figma page")
    .option("-t, --token <token>", "Figma token");

cli.command(
    "[framework]",
    "Generate components from figma for a specific framework"
)
    .option("-o, --output <string>", "output path")
    .action(start);

cli.command(
    "download",
    "Download Figma page components as SVGs to a specified location"
)
    .option("-o, --output <string>", "Download path")
    .action(downloadFigma);

cli.help();

cli.parse();
