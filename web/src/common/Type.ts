export type ProcessPipeLine = ({ stdin: string } | { stdout: string } | { stderr: string })[];
export type CommandResult = { output: ProcessPipeLine, exitCode: number | null };
