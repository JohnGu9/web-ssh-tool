import express from 'express';
import multer from 'multer';
import path from 'path';
import process from 'process';
import { promises as fs } from 'fs';

import { Context, exists } from './common';

const isDebug = process.env.NODE_ENV !== 'production'; // do not export this variable

async function upload(urlPath: string, app: express.Express, context: Context) {
  const dest = await (async () => {
    if (context.uploadPath) {
      if (await exists(context.uploadPath)) {
        const state = await fs.lstat(context.uploadPath);
        if (!state.isDirectory()) throw new Error(`upload "${context.uploadPath} is not directory"`);
      }
      // multer will automatically create folder if path is not exists
      return context.uploadPath;
    } else {
      const temp = await fs.mkdtemp(path.join(process.cwd(), 'uploads-'));
      context.logger.log(`upload file store in temporary directory [${temp}] (warning: temporary directory will be removed when process exit)`);
      (isDebug
        ? [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]
        : [`exit`, `SIGINT`]).forEach((eventType) => {
          process.once(eventType, async () => {
            await fs.rmdir(temp, { maxRetries: 3 });
            process.exit();
          });
        });
      return temp;
    }
  })();
  const config = multer({ dest });
  app.post(urlPath,
    function (req, res, next) {
      const tokenComponent = req.query['t'];
      if (typeof tokenComponent !== 'string' || !context.token.verify(tokenComponent))
        return res.status(400).send('Bad request');
      next();
    },
    config.single('file'),
    async (req, res) => {
      const { fileValidationError: error, file, header: { "x-forwarded-for": forward } }
        = req as typeof req & { fileValidationError: any, header: { 'x-forwarded-for': any } };
      if (error) return res.status(400).json({ error });
      else if (file === undefined) return res.status(400).json({ error: 'No files were uploaded.' });
      context.logger.log(`uploaded file [${file.path} ] from [${forward ?? req.socket.remoteAddress}]`);
      res.json(file);
    });
}

export default upload;
