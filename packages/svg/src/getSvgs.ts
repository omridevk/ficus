import path from "path";
import fse from "fs-extra";
import globAsync from "fast-glob";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getSvgs({
    templatePath,
    svgDir,
}: {
    templatePath: string;
    svgDir: string;
}) {
    const [svgPaths, template] = await Promise.all([
        globAsync(path.join(svgDir, "**/*.svg")),
        fse.readFile(path.join(__dirname, templatePath), {
            encoding: "utf8",
        }),
    ]);
    return {
        svgPaths,
        template,
    };
}
