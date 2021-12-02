import express from 'express';
import path from 'path';
import { createReadStream } from "fs";

import { Context, exists } from "./common";

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
      if (await exists(filePath)) {
        res.attachment(path.basename(filePath));
        const stream = createReadStream(filePath);
        return stream.pipe(res);
      }
    }
    res.status(404).send('Unknown operation');
  });
}

export default download;
