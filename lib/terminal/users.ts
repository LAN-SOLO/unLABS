// _unOS User Management System

export interface UnOSUser {
  uid: number
  username: string
  groups: string[]
  home: string
  shell: string
  isRoot: boolean
}

export class UserManager {
  private users: Map<string, UnOSUser>
  private passwords: Map<string, string> // simulated password hashes
  private _currentUser: string = 'operator'

  constructor() {
    this.users = new Map()
    this.passwords = new Map()
    this.initDefaultUsers()
  }

  private initDefaultUsers() {
    this.users.set('root', {
      uid: 0,
      username: 'root',
      groups: ['root'],
      home: '/root',
      shell: '/bin/sh',
      isRoot: true,
    })

    this.users.set('adm', {
      uid: 1000,
      username: 'adm',
      groups: ['adm', 'wheel', 'sudo', 'operator'],
      home: '/home/adm',
      shell: '/bin/sh',
      isRoot: false,
    })

    this.users.set('operator', {
      uid: 1001,
      username: 'operator',
      groups: ['operator', 'games'],
      home: '/home/operator',
      shell: '/bin/sh',
      isRoot: false,
    })

    // Simulated passwords
    this.passwords.set('adm', 'unstable')
    this.passwords.set('operator', 'crystal')
    // root has no direct password — requires su from adm
  }

  get currentUser(): UnOSUser {
    return this.users.get(this._currentUser) ?? this.users.get('operator')!
  }

  get currentUsername(): string {
    return this._currentUser
  }

  whoami(): string {
    return this._currentUser
  }

  id(username?: string): string {
    const target = username || this._currentUser
    const user = this.users.get(target)
    if (!user) return `id: '${target}': no such user`
    const gids = user.groups.map((g, i) => `${1000 + i}(${g})`).join(',')
    return `uid=${user.uid}(${user.username}) gid=${user.uid}(${user.groups[0]}) groups=${gids}`
  }

  su(targetUser: string, password?: string): { success: boolean; message: string } {
    const target = this.users.get(targetUser)
    if (!target) return { success: false, message: `su: user ${targetUser} does not exist` }

    // Switching to root requires being in wheel group
    if (targetUser === 'root') {
      if (!this.canEscalate(this._currentUser)) {
        return { success: false, message: 'su: Permission denied (not in wheel group)' }
      }
      // adm can su to root without password (already authenticated)
      this._currentUser = 'root'
      return { success: true, message: `switched to root` }
    }

    // Root can switch to anyone without password
    if (this._currentUser === 'root') {
      this._currentUser = targetUser
      return { success: true, message: `switched to ${targetUser}` }
    }

    // Verify password for non-root targets
    if (password === undefined) {
      return { success: false, message: 'password required' }
    }

    const storedPass = this.passwords.get(targetUser)
    if (storedPass && password !== storedPass) {
      return { success: false, message: 'su: Authentication failure' }
    }

    this._currentUser = targetUser
    return { success: true, message: `switched to ${targetUser}` }
  }

  canEscalate(username: string): boolean {
    const user = this.users.get(username)
    if (!user) return false
    return user.groups.includes('wheel') || user.groups.includes('sudo')
  }

  canSudo(): boolean {
    return this._currentUser === 'root' || this.canEscalate(this._currentUser)
  }

  isRoot(): boolean {
    return this._currentUser === 'root'
  }

  passwd(username: string, newPass: string): { success: boolean; message: string } {
    if (!this.users.has(username)) {
      return { success: false, message: `passwd: user '${username}' does not exist` }
    }
    if (this._currentUser !== 'root' && this._currentUser !== username) {
      return { success: false, message: 'passwd: Permission denied' }
    }
    this.passwords.set(username, newPass)
    return { success: true, message: `passwd: password updated for ${username}` }
  }

  useradd(name: string, opts: { uid?: number; groups?: string[]; home?: string } = {}): { success: boolean; message: string } {
    if (this._currentUser !== 'root') {
      return { success: false, message: 'useradd: Permission denied (must be root)' }
    }
    if (this.users.has(name)) {
      return { success: false, message: `useradd: user '${name}' already exists` }
    }

    const uid = opts.uid ?? (Math.max(...Array.from(this.users.values()).map(u => u.uid)) + 1)
    this.users.set(name, {
      uid,
      username: name,
      groups: opts.groups ?? [name],
      home: opts.home ?? `/home/${name}`,
      shell: '/bin/sh',
      isRoot: false,
    })
    this.passwords.set(name, name) // default password = username
    return { success: true, message: `useradd: user '${name}' created (uid=${uid})` }
  }

  usermod(name: string, opts: { groups?: string[] }): { success: boolean; message: string } {
    if (this._currentUser !== 'root') {
      return { success: false, message: 'usermod: Permission denied' }
    }
    const user = this.users.get(name)
    if (!user) return { success: false, message: `usermod: user '${name}' does not exist` }
    if (opts.groups) user.groups = opts.groups
    return { success: true, message: `usermod: user '${name}' updated` }
  }

  groups(username?: string): string {
    const target = username || this._currentUser
    const user = this.users.get(target)
    if (!user) return `groups: '${target}': no such user`
    return `${target} : ${user.groups.join(' ')}`
  }

  getUser(username: string): UnOSUser | undefined {
    return this.users.get(username)
  }

  verifyPassword(username: string, password: string): boolean {
    return this.passwords.get(username) === password
  }

  toJSON(): string {
    const usersArr = Array.from(this.users.entries())
    const passArr = Array.from(this.passwords.entries())
    return JSON.stringify({
      currentUser: this._currentUser,
      users: usersArr,
      passwords: passArr,
    })
  }

  static fromJSON(json: string): UserManager {
    const mgr = new UserManager()
    try {
      const data = JSON.parse(json)
      mgr._currentUser = data.currentUser || 'operator'
      if (data.users) {
        mgr.users = new Map(data.users)
      }
      if (data.passwords) {
        mgr.passwords = new Map(data.passwords)
      }
    } catch {
      // Return default on parse error
    }
    return mgr
  }
}
