import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import https from 'https';
import fs from 'fs/promises';
import os from 'os';
import { AddressInfo, Socket } from 'net';
import { URL } from 'url';

import { concurrent, Context, getConfiguration } from 'src/common';
import upload from 'src/upload';
import download from 'src/download';
import watch from 'src/watch';
import rest from 'src/rest';

export { };

const isDebug = process.env.NODE_ENV !== 'production'; // do not export this variable

async function main() {
  const { port, address, uploadPath, httpsCert, httpsKey } = await getConfiguration();
  const context = new Context({ uploadPath });

  const app = express();
  if (isDebug) app.use(cors({ origin: '*' }));
  app.use(compression());
  app.use(express.static(path.join('web', 'build')));

  const [wss1, wss2] = await Promise.all([
    rest(context),
    watch(context),
    upload('/upload', app, context),
    download('/download', app, context),
  ]);

  const server = https.createServer(await concurrent({
    key: fs.readFile(httpsKey ?? path.join('node', 'https', 'server.key')),
    cert: fs.readFile(httpsCert ?? path.join('node', 'https', 'server.crt')),
  }), app);

  server.on('upgrade', (request, socket: Socket, head) => {
    const { url, headers: { host } } = request;
    if (url) {
      const { pathname } = new URL(url, `http://${host}`); // base must be http
      switch (pathname) {
        case '/rest':
          return wss1.handleUpgrade(request, socket, head,
            (ws) => wss1.emit('connection', ws, request));
        case '/watch':
          return wss2.handleUpgrade(request, socket, head,
            (ws) => wss2.emit('connection', ws, request));
      }
    }
    socket.destroy();
  });

  server.listen(port, address, () => {
    const protocol = 'https:';

    const { address: listenAddress, port, family } = server.address() as AddressInfo; // http/s server always return AddressInfo
    const info = `address[${listenAddress}] port[${port}] family[${family}]`;
    console.log(`Listening on         ${info}`);
    console.log();
    console.log(`Local:               ${protocol}//localhost:${port}`);

    if (address) return console.log(`On Your network:     ${protocol}//${address}:${port}`);

    let first = true;
    const interfaces = os.networkInterfaces();
    for (const [name, net] of Object.entries(interfaces)) {
      if (!name.startsWith('lo') && net) {
        for (const info of net.filter(value => value.family === 'IPv4'))
          if (first) {
            console.log(`On Your network:     ${protocol}//${info.address}:${port}`);
            first = false;
          } else
            console.log(`                     ${protocol}//${info.address}:${port}`);
      }
    }
    console.log();
  });
}

main();