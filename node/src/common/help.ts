import { configEnvVariable } from "./configuration";

class Description {
  constructor(props: { description: string, example: string | undefined }) {
    this.description = props.description;
    this.example = props.example ? `(example: ${props.example})` : ''
  }
  description: string;
  example: string;
}

export function help() {
  const { log, table } = console;
  log('server man: ');
  table({
    '-h --help': new Description({ description: 'get help man', example: '--help' }),
    '-v --version': new Description({ description: 'display version information', example: '--version' }),
    '-c --config': new Description({ description: 'load config file', example: '--config=config.json' }),
    '-a --address': new Description({ description: 'setup server listen address', example: '--address=192.168.1.0' }),
    '-o --port': new Description({ description: 'setup server listen port', example: '--port=6000' }),
    '-u --upload': new Description({ description: 'setup upload file folder', example: '--upload=/user/archive' }),

    '-hd --https-disable': new Description({ description: 'disable https mode', example: '--https-disable' }),
    '-hk --https-key': new Description({ description: 'setup https server key', example: '--https-key=test/fixtures/keys/agent2-key.pem' }),
    '-hc --https-cert': new Description({ description: 'setup https server cert', example: '--https-cert=test/fixtures/keys/agent2-cert.pem' }),
  });
  log();
  log(`tip: config file ("-c" or "--config") also support env variable            (example: ${configEnvVariable}=/etc/config.json && ./bu-manager-linux)`);
  log();
}
