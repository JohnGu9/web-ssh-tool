import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import posixPath from 'node:path/posix';
import { licenseBundle } from './build-liscense'

async function main() {
    console.log("running build-rust-assets.ts");
    const webBuildPath = path.join(__dirname, "web", "build");
    const rustPath = path.join(__dirname, "rust", "src", "http_server", "file_send");
    const rustAssetsPath = path.join(rustPath, "build");
    await licenseBundle(path.join(webBuildPath, 'LICENSE'));
    await fs.rm(rustAssetsPath, { recursive: true }).catch(function () { });
    await fs.mkdir(rustAssetsPath, { recursive: true });
    await fs.cp(webBuildPath, rustAssetsPath, { recursive: true });
    await buildAssetsMap(rustPath);
}
main();


async function buildAssetsMap(p: string) {
    const rustSource = path.join(p, "assets_map.rs");
    const assets = path.join(p, "build");
    const assetsMap: (string[])[] = [];
    async function loopDir(dir: string, internalDir: string[], assetsMap: (string[])[]) {
        for await (const entry of await fs.opendir(dir)) {
            if (entry.isFile()) {
                assetsMap.push([...internalDir, entry.name]);
            } else if (entry.isDirectory()) {
                const subDir = path.join(dir, entry.name);
                const subInternalDir = [...internalDir, entry.name]
                await loopDir(subDir, subInternalDir, assetsMap);
            }
        }
    }
    await loopDir(assets, [], assetsMap);
    const writeStream = createWriteStream(rustSource);
    writeStream.write(Buffer.from(
        `pub fn assets_map(filename: &str) -> Result<&'static [u8], ()> {
    match filename {
`));
    for (const assets of assetsMap) {
        const p0 = posixPath.join(...assets);
        const p1 = path.join("build", ...assets);
        writeStream.write(Buffer.from(`        "${p0}" => Ok(include_bytes!("${p1}")),
`));
    }
    writeStream.write(Buffer.from(
        `        _ => Err(()),
    }
}`));

}


