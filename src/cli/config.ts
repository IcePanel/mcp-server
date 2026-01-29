export type CliConfig = {
  transport: string;
  port: number;
  portRaw: string;
  updatedEnv: NodeJS.ProcessEnv;
  usedDeprecatedSse: boolean;
};

function stripOuterQuotes(value: string): string {
  return value.replace(/^["'](.*)["']$/, "$1");
}

export function parseCliConfig(args: string[], env: NodeJS.ProcessEnv): CliConfig {
  const updatedEnv: NodeJS.ProcessEnv = { ...env };

  for (const arg of args) {
    const match = arg.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      updatedEnv[key] = stripOuterQuotes(value);
    }
  }

  let transport = updatedEnv.MCP_TRANSPORT || "stdio";
  let portRaw = updatedEnv.MCP_PORT || "3000";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--transport" && args[i + 1]) {
      transport = args[i + 1];
      i++;
      continue;
    }

    if (arg === "--port" && args[i + 1]) {
      portRaw = args[i + 1];
      i++;
    }
  }

  let usedDeprecatedSse = false;
  if (transport === "sse") {
    usedDeprecatedSse = true;
    transport = "http";
  }

  const port = Number.parseInt(portRaw, 10);

  return {
    transport,
    port,
    portRaw,
    updatedEnv,
    usedDeprecatedSse,
  };
}
