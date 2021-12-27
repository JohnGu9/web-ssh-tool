import express from 'express';
import multer, { diskStorage } from 'multer';
import path from 'path';
import process from 'process';
import { promises as fs } from 'fs';

import { Context, exists } from './common';

async function upload(urlPath: string, app: express.Express, context: Context) {
  const destination = await (async () => {
    if (context.upload) {
      if (await exists(context.upload)) {
        const state = await fs.lstat(context.upload);
        if (!state.isDirectory()) throw new Error(`upload "${context.upload} is not directory"`);
      }
      // multer will automatically create folder if path is not exists
      return context.upload;
    } else {
      const temp = await fs.mkdtemp(path.join(process.cwd(), 'uploads-'));
      context.logger.log(`upload file store in temporary directory [${temp}] (warning: temporary directory will be removed when process exit)`);
      process.once('SIGINT', async (signal) => {
        await fs.rm(temp, { recursive: true });
        process.kill(process.pid, signal);
      });
      process.once('exit', async (code) => {
        await fs.rm(temp, { recursive: true });
        process.exit(code);
      });
      return temp;
    }
  })();
  const config = multer({
    storage: diskStorage({
      destination,
      filename: (req, file, cb) => {
        const fileName = `${Date.now()}`;
        const filePath = path.join(destination, fileName);
        const cleanup = () => fs.unlink(filePath).catch(function () { });
        req.once('error', cleanup);
        req.once('aborted', cleanup);
        cb(null, fileName);
      }
    })
  });
  return app.post(urlPath,
    function (req, res, next) {
      const token = req.query['t'];
      if (typeof token !== 'string' || !context.token.verify(token)) {
        context.logger.error(`upload request token verify failed from [${req.socket.remoteAddress}]`);
        return res.status(400).send('Bad request');
      }
      return next();
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
