import express from 'express';
import path from 'path';
import { createReadStream, promises as fs } from "fs";
import archiver from 'archiver';

import { Context, getFileType } from "./common";
import { FileType } from 'web/common/Type';

async function download(urlPath: string, app: express.Express, context: Context) {
  app.get(urlPath, function (req, res, next) {
    const tokenComponent = req.query['t'];
    if (typeof tokenComponent !== 'string' || !context.token.verify(tokenComponent))
      return res.status(404).send('Unknown operation');
    next();
  }, async function (req, res) {
    const pathComponent = req.query['p'];
    if (typeof pathComponent === 'string') {
      const filePath = decodeURIComponent(pathComponent);
      try {
        const lstat = await fs.lstat(filePath);
        const type = getFileType(lstat);
        switch (type) {
          case FileType.file: {
            res.attachment(path.basename(filePath));
            const stream = createReadStream(filePath);
            res.on('end', () => stream.close());
            return stream.pipe(res);
          }
          case FileType.directory: {
            res.attachment(`${path.basename(filePath)}.zip`);
            const zip = archiver('zip');
            zip.pipe(res);
            zip.directory(filePath, false);
            zip.finalize();
            return res.on('end', () => zip.destroy());
          }
        }
      } catch (error) {
      }
    }
    res.status(404).send('Unknown operation');
  });
}

export default download;
