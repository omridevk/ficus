import nodeResolve from '@rollup/plugin-node-resolve'
import {builtinModules} from 'module'
import pkg from './package.json'
import commonjs from '@rollup/plugin-commonjs'
import esbuild from 'rollup-plugin-esbuild'
import json from '@rollup/plugin-json'
import {relative} from 'pathe'

const external = [
    ...builtinModules,
    ...Object.keys(pkg.dependencies),
    'worker_threads',
    'inspector',
]

export default {
    input: 'src/cli.ts',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: (chunkInfo) => {
            const id = chunkInfo.facadeModuleId || Object.keys(chunkInfo.modules).find(i => !i.includes('node_modules') && i.includes('src/'))
            if (id) {
                const parts = Array.from(
                    new Set(relative(process.cwd(), id).split(/\//g)
                        .map(i => i.replace(/\..*$/, ''))
                        .filter(i => !['src', 'index', 'dist', 'node_modules'].some(j => i.includes(j)) && i.match(/^[\w_-]+$/))),
                )
                if (parts.length)
                    return `chunk-${parts.slice(-2).join('-')}.[hash].mjs`
            }
            return 'vendor-[name].[hash].mjs'
        },
    },
    external,
    plugins: [
        nodeResolve({
            preferBuiltins: true,
        }),
        json(),
        commonjs(),
        esbuild({
        target: 'node14',
    })]
}
