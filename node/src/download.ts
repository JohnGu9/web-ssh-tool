import express from 'express';
import path from 'path';
import { createReadStream, promises as fs } from "fs";
import archiver from 'archiver';

import { Context, getFileType } from "./common";
import { FileType } from 'web/common/Type';
import { Writable } from 'stream';

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
      const target = req.query['p'];
      context.logger.log(`download request [${target}] from [${req.socket.remoteAddress}]`);
      res.on('error', error => context.logger.error(`download response cause error [${error}]`));
      if (typeof target === 'string' || (target instanceof Array)) {
        rawDownload(target as string | string[], res,
          filename => res.attachment(filename),
          error => context.logger.error(`download [${target}] cause error [${error}]`));
      } else {
        context.logger.error(`download unknown request from ${req.socket.remoteAddress}`);
        res.status(404).send('Unknown operation');
      }
    });
}

export default download;


export async function rawDownload(target: string | string[], output: Writable, onFileName: (filename: string) => unknown, onError: (error: Error) => unknown) {
  if (typeof target === 'string') {
    try {
      const lstat = await fs.lstat(target);
      const type = getFileType(lstat);
      switch (type) {
        case FileType.file: {
          onFileName(path.basename(target));
          const stream = createReadStream(target);
          stream.on('error', onError);
          return stream.pipe(output);
        }
        case FileType.directory: {
          onFileName(`${path.basename(target)}.zip`);
          const zip = archiver('zip');
          zip.pipe(output);
          zip.directory(target, false);
          zip.on('error', onError);
          return zip.finalize();
        }
      }
    } catch (error) {
      onError(error as Error);
    }
  } else if (target instanceof Array) {
    onFileName(`bundle.zip`);
    const zip = archiver('zip');
    zip.pipe(output);
    for (const item of target as string[]) {
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
        onError(error as Error);
      }
    }
    zip.on('error', onError);
    return zip.finalize();
  }
}