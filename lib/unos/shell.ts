// _unOS v2.0 — UnShell Interpreter (unsh)
// Placeholder for future shell features (piping, redirection, scripting)

export interface ShellConfig {
  prompt: string
  historySize: number
  aliases: Record<string, string>
}

export class UnShell {
  private config: ShellConfig
  private aliases: Map<string, string>

  constructor() {
    this.config = {
      prompt: '\\u@_unLAB:\\w\\$',
      historySize: 500,
      aliases: {},
    }
    this.aliases = new Map([
      ['ll', 'ls -la'],
      ['la', 'ls -a'],
      ['..', 'cd ..'],
      ['cls', 'clear'],
    ])
  }

  expandAlias(input: string): string {
    const parts = input.trim().split(/\s+/)
    const cmd = parts[0]
    const alias = this.aliases.get(cmd)
    if (alias) {
      parts[0] = alias
      return parts.join(' ')
    }
    return input
  }

  setAlias(name: string, value: string) {
    this.aliases.set(name, value)
  }

  removeAlias(name: string) {
    this.aliases.delete(name)
  }

  listAliases(): Record<string, string> {
    return Object.fromEntries(this.aliases)
  }

  getConfig(): ShellConfig {
    return { ...this.config, aliases: Object.fromEntries(this.aliases) }
  }

  toJSON(): { config: ShellConfig; aliases: [string, string][] } {
    return {
      config: this.config,
      aliases: Array.from(this.aliases.entries()),
    }
  }

  static fromJSON(data: { config: ShellConfig; aliases: [string, string][] }): UnShell {
    const shell = new UnShell()
    shell.config = data.config
    shell.aliases = new Map(data.aliases)
    return shell
  }
}
