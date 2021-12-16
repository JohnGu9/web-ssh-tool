import express from 'express';
import multer from 'multer';
import path from 'path';
import process from 'process';
import { promises as fs } from 'fs';

import { Context, exists } from './common';

async function upload(urlPath: string, app: express.Express, context: Context) {
  const dest = await (async () => {
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
        await fs.rmdir(temp, { maxRetries: 3 });
        process.kill(process.pid, signal);
      });
      process.once('exit', async (code) => {
        await fs.rmdir(temp, { maxRetries: 3 });
        process.exit(code);
      });
      return temp;
    }
  })();
  const config = multer({ dest });
  app.post(urlPath,
    function (req, res, next) {
      const token = req.query['t'];
      if (typeof token !== 'string' || !context.token.verify(token))
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
      setTimeout(async () => {
        const { path } = file;
        if (await exists(path)) await fs.unlink(path);
      }, 10 * 1000); // auto clean up unused files
    });
}

export default upload;
