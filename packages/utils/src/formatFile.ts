import fse from "fs-extra";
import * as prettier from "prettier";

export async function formatFile(file: string) {
    let options = {
        filepath: file,
    };
    const data = await fse.readFile(file, 'utf-8');

    const resolvedOptions = await prettier.resolveConfig(file, {
        editorconfig: true,
    });
    options = {
        ...options,
        ...resolvedOptions,
    };
    const formatted = prettier.format(data, options);
    await fse.writeFile(file, formatted);
}
