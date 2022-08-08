import fse from 'fs-extra';
import yargs from 'yargs';
import path from 'path';
import rimraf from "rimraf";
import Mustache from 'mustache';
import Queue from './waterfall/Queue';
import globAsync from 'fast-glob';
import * as svgo from 'svgo';
import * as prettier from 'prettier';
import renameFilterDefault from './rename-filters';
import {camelCase} from 'change-case'


import {getComponentName} from './utils/getComponentName';

export const RENAME_FILTER_DEFAULT = './rename-filters/default';

async function generateIndex(options) {
    path.join(options.svgDir, options.glob);
    const files = await globAsync(path.join(options.outputDir, '**/*.vue'));
    const index = files.map((file) => {
        const fileName = path.basename(file).replace('.vue', '');
        const typename = camelCase(fileName);
        return `
        '${typename}': {
          fileName: '${path.basename(fileName)}',
        }
      `;
        // return `export { default as ${typename} } from './lib/${typename}.vue';\n`;
    });
    const indexFile = ['export const icons = {', index, '}'].join('');

    await fse.writeFile(path.join(options.outputDir, 'index.ts'), indexFile);
    await formatFile(path.join(options.outputDir, 'index.ts'));
}

export function cleanPaths({svgPath, data}) {
    // Remove hardcoded color fill before optimizing so that empty groups are removed
    const input = data
        .replace(/<rect fill="none" width="24" height="24"\/>/g, '')

        .replace(/<rect id="SVGID_1_" width="24" height="24"\/>/g, '');

    const result = svgo.optimize(input, {
        floatPrecision: 4,
        multipass: true,
        plugins: [
            {name: 'cleanupAttrs'},
            {name: 'removeDoctype'},
            {name: 'removeXMLProcInst'},
            {name: 'removeComments'},
            {name: 'removeMetadata'},
            {name: 'removeTitle'},
            {name: 'removeDesc'},
            {name: 'removeUselessDefs'},
            {name: 'removeXMLNS'},
            {name: 'removeEditorsNSData'},
            {name: 'removeEmptyAttrs'},
            {name: 'removeHiddenElems'},
            {name: 'removeEmptyText'},
            {name: 'removeViewBox'},
            {name: 'cleanupEnableBackground'},
            {name: 'minifyStyles'},
            {name: 'convertStyleToAttrs'},
            {name: 'convertColors'},
            {name: 'convertPathData'},
            {name: 'convertTransform'},
            {name: 'removeUnknownsAndDefaults'},
            {name: 'removeNonInheritableGroupAttrs'},
            {
                name: 'removeUselessStrokeAndFill',
                params: {
                    // https://github.com/svg/svgo/issues/727#issuecomment-303115276
                    // removeNone: true,
                },
            },
            {name: 'removeUnusedNS'},
            {name: 'cleanupIDs'},
            {name: 'cleanupNumericValues'},
            {name: 'cleanupListOfValues'},
            {name: 'moveElemsAttrsToGroup'},
            {name: 'moveGroupAttrsToElems'},
            {name: 'collapseGroups'},
            {name: 'removeRasterImages'},
            {name: 'mergePaths'},
            {name: 'convertShapeToPath'},
            {name: 'sortAttrs'},
            {name: 'removeDimensions'},
            {
                name: 'removeAttrs',
                params: {
                    attrs: 'stroke-linecap',
                },
            },
            {name: 'removeElementsByAttr'},
            {name: 'removeStyleElement'},
            {name: 'removeScriptElement'},
            {name: 'removeEmptyContainers'},
        ],
    });
    const jsxResult = svgo.optimize(result.data);
    // Extract the paths from the svg string
    // Clean xml paths
    let paths = jsxResult.data
        .replace(/"\/>/g, '" />')
        .replace(/ clip-path=".+?"/g, '') // Fix visibility issue and save some bytes.
        .replace(/<clipPath.+?<\/clipPath>/g, ''); // Remove unused definitions

    const size = Number(path.basename(path.dirname(svgPath)));
    if (size && size !== 24) {
        const scale = Math.round((24 / size) * 100) / 100; // Keep a maximum of 2 decimals
        paths = paths.replace('clipPath="url(#b)" ', '');
        paths = paths.replace(
            /<path /g,
            `<path transform="scale(${scale}, ${scale})" fill="none" `
        );
    }
    // replace stroke and fill with inherit color
    paths = paths.replace(/fill=".+?"/g, 'fill="currentColor"');
    paths = paths.replace(/stroke=".+?"/g, ' stroke="currentColor"');
    if (!/fill=".+?"/.test(paths)) {
        paths = paths.replace(/<path /g, '<path fill="none" ');
    }

    return paths;
}


async function worker({progress, svgPath, options, renameFilter, template}) {
    progress();

    const normalizedSvgPath = path.normalize(svgPath);
    const svgPathObj = path.parse(normalizedSvgPath);
    const innerPath = path
        .dirname(normalizedSvgPath)
        .replace(options.svgDir, '')
        .replace(path.relative(process.cwd(), options.svgDir), ''); // for relative dirs
    const destPath = renameFilter(svgPathObj, innerPath, options);
    const outputFileDir = path.dirname(path.join(options.outputDir, destPath));
    await fse.ensureDir(outputFileDir);
    try {
        const data = await fse.readFile(svgPath, {encoding: 'utf8'});
        const paths = cleanPaths({svgPath, data});
        const componentName = getComponentName(destPath);

        const fileString = Mustache.render(template, {
            paths,
            componentName,
        });

        const absDestPath = path.join(options.outputDir, destPath);
        await fse.writeFile(absDestPath, fileString);
        await formatFile(absDestPath);
    } catch (e) {
        return null;
    }
}

async function formatFile(file) {
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


;(async () => {
    await handler({});
})();

export async function handler(options) {
    const progress = options.disableLog
        ? // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {
        }
        : () => process.stdout.write('.');

    rimraf.sync(`${options.outputDir}/*.vue`); // Clean old files

    let renameFilter = options.renameFilter || renameFilterDefault;
    if (typeof renameFilter !== 'function') {
        throw Error('renameFilter must be a function');
    }
    await fse.ensureDir(options.outputDir);

    const [svgPaths, template] = await Promise.all([
        globAsync(path.join(options.svgDir, options.glob)),
        fse.readFile(path.join(__dirname, 'templateSvgIcon.js.mustache'), {
            encoding: 'utf8',
        }),
    ]);
    console.info('Generating icons');

    const queue = new Queue(
        (svgPath) =>
            worker({
                progress,
                svgPath,
                options,
                renameFilter,
                template,
            }),
        {concurrency: 8}
    );

    queue.push(svgPaths);
    await queue.wait({empty: true});
    await generateIndex(options);
    console.info('\nDone generating icons');
}
