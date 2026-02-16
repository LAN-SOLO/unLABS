// _unOS v2.0 — UnShell Interpreter (unsh)
// Shell features: environment variables, aliases, variable expansion

export interface ShellConfig {
  prompt: string
  historySize: number
  aliases: Record<string, string>
}

export class UnShell {
  private config: ShellConfig
  private aliases: Map<string, string>
  private env: Map<string, string>

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
    this.env = new Map([
      ['PATH', '/unbin:/unusr/bin'],
      ['HOME', '/unhome/operator'],
      ['USER', 'operator'],
      ['SHELL', '/unbin/unsh'],
      ['TERM', 'xterm-256color'],
      ['LANG', 'en_US.UTF-8'],
      ['HOSTNAME', '_unLAB'],
      ['PWD', '/unhome/operator'],
      ['OLDPWD', '/unhome/operator'],
      ['PS1', '\\u@_unLAB:\\w\\$'],
      ['EDITOR', 'unmcedit'],
      ['PAGER', 'cat'],
    ])
  }

  // --- Environment Variables ---

  getEnv(key: string): string | undefined {
    return this.env.get(key)
  }

  setEnv(key: string, value: string): void {
    this.env.set(key, value)
  }

  unsetEnv(key: string): void {
    this.env.delete(key)
  }

  getAllEnv(): Record<string, string> {
    return Object.fromEntries(this.env)
  }

  /** Expand $VAR and ${VAR} in a string */
  expandVars(input: string): string {
    return input.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, plain) => {
      const key = braced || plain
      return this.env.get(key) ?? ''
    })
  }

  // --- Aliases ---

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

  getAlias(name: string): string | undefined {
    return this.aliases.get(name)
  }

  setAlias(name: string, value: string) {
    this.aliases.set(name, value)
  }

  removeAlias(name: string): boolean {
    return this.aliases.delete(name)
  }

  listAliases(): Record<string, string> {
    return Object.fromEntries(this.aliases)
  }

  getConfig(): ShellConfig {
    return { ...this.config, aliases: Object.fromEntries(this.aliases) }
  }

  toJSON(): { config: ShellConfig; aliases: [string, string][]; env: [string, string][] } {
    return {
      config: this.config,
      aliases: Array.from(this.aliases.entries()),
      env: Array.from(this.env.entries()),
    }
  }

  static fromJSON(data: { config: ShellConfig; aliases: [string, string][]; env?: [string, string][] }): UnShell {
    const shell = new UnShell()
    shell.config = data.config
    shell.aliases = new Map(data.aliases)
    if (data.env) {
      shell.env = new Map(data.env)
    }
    return shell
  }
}
