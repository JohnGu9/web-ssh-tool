import path from 'path';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import licenseChecker, { ModuleInfos } from 'license-checker';

function checker(start: string) {
    return new Promise<ModuleInfos>(resolve =>
        licenseChecker.init(
            { start },
            (error, result) => resolve(result)),
    );
}

export async function licenseBundle(target: string) {
    const writeStream = createWriteStream(target);
    const [nodeLicenses, licenses] = await Promise.all([
        checker(path.join(__dirname, 'node')),
        checker(__dirname),
        (async () => {
            const dir = path.join(__dirname, 'web', 'build', 'static', 'js');
            for await (const { name: file } of await fs.opendir(dir)) {
                if (file.endsWith('LICENSE.txt')) {
                    for await (const chunk of createReadStream(path.join(dir, file)))
                        writeStream.write(chunk);
                }
            }
        })(),
    ]);

    const buffer2 = Buffer.from('\n\n');
    for (const [name, { licenseFile }] of [...Object.entries(nodeLicenses), ...Object.entries(licenses)]) {
        if (licenseFile) {
            writeStream.write(Buffer.from(`\n${name}\n`));
            for await (const chunk of createReadStream(licenseFile))
                writeStream.write(chunk);
            writeStream.write(buffer2);
        }
    }
    return new Promise(resolve => {
        writeStream.once('close', resolve);
        writeStream.end();
    })
}
