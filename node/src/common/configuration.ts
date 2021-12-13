import fs from "fs/promises";
import process from 'process';
import { getArgv } from "./tools";

export const configEnvVariable = 'WEB_SSH_TOOL_CONFIG';

export type Configuration = {
  address?: string,
  port?: number,
  home?: string,
  upload?: string,
  log?: string,

  httpsKey?: string,
  httpsCert?: string,
}

export async function getConfiguration(): Promise<Configuration> {
  // config file
  const configFilePath = getArgv('-c', '--config') ?? process.env[configEnvVariable];
  const config = await (async (): Promise<Configuration> => {
    if (configFilePath) {
      const fileBuffer = await fs.readFile(configFilePath);
      const data = JSON.parse(fileBuffer.toString());
      return {
        address: data['address'],
        port: data['port'],
        home: data['home'],
        upload: data['upload'],
        log: data['log'],
        httpsKey: data['https-key'],
        httpsCert: data['https-cert'],
      };
    }
    return {}
  })();

  //address
  const address = getArgv('-a', '--address');
  if (address) config.address = address;
  if (config.address && typeof config.address !== 'string')
    throw new Error('"address" parameter type error (require String type parameter)');

  // port
  const customPortString = getArgv('-o', '--port');
  const port = customPortString ? Number.parseInt(customPortString) : undefined;
  if (port) config.port = port;
  if (config.port && Number.isNaN(config.port))
    throw new Error('"port" parameter type error (require Number type parameter)');

  // home 
  const home = getArgv('-h', '--home');
  if (home) config.home = home;
  if (config.home && typeof config.home !== 'string')
    throw new Error('"home" parameter type error (require String type parameter)');

  // upload 
  const upload = getArgv('-u', '--upload');
  if (upload) config.upload = upload;
  if (config.upload && typeof config.upload !== 'string')
    throw new Error('"upload" parameter type error (require String type parameter)');

  // log 
  const log = getArgv('-l', '--log');
  if (log) config.log = log;
  if (config.log && typeof config.log !== 'string')
    throw new Error('"log" parameter type error (require String type parameter)');

  // https key
  const httpsKey = getArgv('-hk', '--https-key');
  if (httpsKey) config.httpsKey = httpsKey;
  if (config.httpsKey && typeof config.httpsKey !== 'string')
    throw new Error('"https-key" parameter type error (require String type parameter)');

  // https cert
  const httpsCert = getArgv('-hc', '--https-cert');
  if (httpsCert) config.httpsCert = httpsCert;
  if (config.httpsCert && typeof config.httpsCert !== 'string')
    throw new Error('"https-cert" parameter type error (require String type parameter)');

  return config;
}
