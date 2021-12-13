import path from 'path';

import { FileLogger, Logger } from './context/logger';
import Token from './context/token';

export class Context {
  constructor(props: {
    upload: string | undefined,
    home: string | undefined,
    log: string | undefined,
    logger?: Logger,
    token?: Token,
  }) {
    this.uploadPath = props.upload;
    this.home = props.home;
    this.log = props.log;
    this.logger = props.logger ?? new FileLogger({ path: this.log ?? 'web_ssh_tool.log' });
    this.token = props.token ?? new Token();
  }

  readonly uploadPath?: string;
  readonly home?: string;
  readonly log?: string;

  readonly logger: Logger;
  readonly token: Token;
}
