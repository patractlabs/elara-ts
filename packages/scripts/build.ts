import { build } from 'esbuild'

interface BuildOptions {
    env: 'pro' | 'dev' | 'test',

}

export async function buildWsRpc(options: BuildOptions) {
    const { env } = options

    await build({
        entryPoints: ['packages/wsrpc/app.ts'], // 我们从这个入口点读应用程序
        outfile: 'packages/wsrpc/dist/app.js', 
        // outdir: 'packages/wsrpc/dist',
        // define: {
        //     'process.env.NODE_ENV': `${env}`, // 我们需要定义构建应用程序的 Node.js 环境
        // },
        platform: 'node',
        target: 'node14.16.1',
        bundle: true,
        minify: env === 'pro',
        sourcemap: env === 'dev',
    })
}

async function buildAll() {
    await Promise.all([
        buildWsRpc({
            env: 'pro'
        })
    ])
}

buildAll()