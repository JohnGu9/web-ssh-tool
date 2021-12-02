import path from 'path';

import { FileLogger, Logger } from './context/logger';
import Token from './context/token';

export class Context {
  constructor(props: {
    uploadPath?: string,
    logger?: Logger,
    token?: Token,
  }) {
    this.uploadPath = props.uploadPath;
    this.logger = props.logger ?? new FileLogger({ path: 'web_ssh_tool.log' });
    this.token = props.token ?? new Token();
  }
  readonly uploadPath: string | undefined;
  readonly logger: Logger;
  readonly token: Token;
}
