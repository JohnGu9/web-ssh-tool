import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import licenseChecker, { ModuleInfos } from 'license-checker';
import { exec } from 'child_process';

export async function licenseBundle(target: string) {
    const writeStream = createWriteStream(target);
    const [licenses, webLicense, rustLicenses] = await Promise.all([
        checker(__dirname),
        checker(path.join(__dirname, 'web')),
        rustLicense(),
    ]);

    const buffer2 = Buffer.from('\n\n');
    for (const [name, { licenseFile }] of [...Object.entries(webLicense), ...Object.entries(licenses)]) {
        if (licenseFile && licenseFile.toLowerCase().includes("license")) {
            writeStream.write(Buffer.from(`\n${name}\n`));
            for await (const chunk of createReadStream(licenseFile))
                writeStream.write(chunk);
            writeStream.write(buffer2);
        }
    }
    if (rustLicenses !== null) {
        for (const license of rustLicenses) {
            writeStream.write(Buffer.from(`\n${license.name}@${license.version}\n`));
            if (license.license_file) {
                for await (const chunk of createReadStream(license.license_file))
                    writeStream.write(chunk);
            } else {
                writeStream.write(Buffer.from(`${license.authors}\n${license.repository}\n${license.license}`));
            }
            writeStream.write(buffer2);
        }
    }
    await new Promise(resolve => {
        writeStream.once('close', resolve);
        writeStream.end();
    })
}

function checker(start: string) {
    return new Promise<ModuleInfos>(resolve =>
        licenseChecker.init(
            { start, direct: true, unknown: false, production: true },
            (error, result) => resolve(result)),
    );
}

function rustLicense() {
    return new Promise<null | RustLicense[]>(resolve => {
        exec("cargo license -d --direct-deps-only --json --current-dir rust", (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                resolve(null);
                return;
            }
            if (stderr) {
                console.log(`error: ${stderr}`);
                resolve(null);
                return;
            }
            try {
                const obj = JSON.parse(stdout);
                resolve(obj);
            } catch (error) {
                console.log(`error: ${error}`);
                resolve(null);
                return;
            }
        });
    });
}

type RustLicense = {
    "name": string,
    "version": string | null,
    "authors": string | null,
    "repository": string | null,
    "license": string | null,
    "license_file": string | null,
    "description": string | null
}

