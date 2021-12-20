import express from 'express';
import path from 'path';
import { createReadStream, promises as fs } from "fs";
import archiver from 'archiver';

import { Context, getFileType } from "./common";
import { FileType } from 'web/common/Type';

async function download(urlPath: string, app: express.Express, context: Context) {
  return app.get(urlPath,
    function (req, res, next) {
      const token = req.query['t'];
      if (typeof token !== 'string' || !context.token.verify(token)) {
        context.logger.error(`download request token verify failed from [${req.socket.remoteAddress}]`);
        return res.status(400).send('Bad request');
      }
      return next();
    },
    async (req, res) => {
      const component = req.query['p'];
      context.logger.log(`download request [${component}] from [${req.socket.remoteAddress}]`);
      res.on('error', error => context.logger.error(`download response cause error [${error}]`))
      if (typeof component === 'string') {
        const target = decodeURIComponent(component);
        try {
          const lstat = await fs.lstat(target);
          const type = getFileType(lstat);
          switch (type) {
            case FileType.file: {
              res.attachment(path.basename(target));
              const stream = createReadStream(target);
              stream.on('error', error => context.logger.error(`download file [${target}] cause error [${error}]`))
              res.on('end', () => stream.close());
              return stream.pipe(res);
            }
            case FileType.directory: {
              res.attachment(`${path.basename(target)}.zip`);
              const zip = archiver('zip');
              zip.pipe(res);
              zip.directory(target, false);
              zip.on('error', error =>
                context.logger.error(`download directory [${target}] cause error [${error}]`));
              res.on('end', () => zip.destroy());
              return zip.finalize();
            }
          }
        } catch (error) {
          context.logger.error(`download cause error [${error}]`);
        }
      } else if (component instanceof Array) {
        res.attachment(`bundle.zip`);
        const zip = archiver('zip');
        zip.pipe(res);
        for (const item of component as string[]) {
          const target = decodeURIComponent(item);
          try {
            const lstat = await fs.lstat(target);
            const type = getFileType(lstat);
            switch (type) {
              case FileType.file: {
                zip.append(createReadStream(target), { name: path.basename(target) });
                break;
              }
              case FileType.directory: {
                zip.directory(target, path.basename(target));
                break;
              }
            }
          } catch (error) {
          }
        }
        zip.on('error', error => context.logger.error(`download bundle cause error [${error}]`))
        res.on('end', () => zip.destroy());
        return zip.finalize();
      }
      context.logger.error(`download unknown request from ${req.socket.remoteAddress}`);
      res.status(404).send('Unknown operation');
    });
}

export default download;
