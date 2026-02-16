// _unOS v2.0 — Virtual Filesystem
// Migrated from lib/terminal/filesystem.ts with un-namespace paths and alias support

import type { VNode, MountPoint } from './types'
import { PATH_ALIASES, UNOS_VERSION, UNOS_CODENAME } from './constants'

export class VirtualFS {
  root: VNode
  private _cwd: string = '/unhome/operator'
  private _previousCwd: string = '/unhome/operator'
  private _mounts: MountPoint[] = []
  private _procfsGenerator: ((path: string) => string | null) | null = null
  private _procfsListDir: ((path: string) => string[] | null) | null = null

  constructor() {
    this.root = this.buildDefaultTree()
    this.initializeMounts()
  }

  /** Set dynamic procfs content generator */
  setProcFS(generator: (path: string) => string | null) {
    this._procfsGenerator = generator
  }

  /** Set dynamic procfs directory listing hook */
  setProcFSListDir(listDir: (path: string) => string[] | null) {
    this._procfsListDir = listDir
  }

  get cwd(): string {
    return this._cwd
  }

  get mounts(): MountPoint[] {
    return [...this._mounts]
  }

  // --- Node creation helpers ---

  private mknode(
    name: string,
    type: VNode['type'],
    opts: {
      content?: string
      permissions?: number
      owner?: string
      group?: string
      target?: string
      deviceType?: 'char' | 'block'
      major?: number
      minor?: number
    } = {}
  ): VNode {
    const now = Date.now()
    const node: VNode = {
      name,
      type,
      permissions: opts.permissions ?? (type === 'dir' ? 0o755 : 0o644),
      owner: opts.owner ?? 'root',
      group: opts.group ?? 'root',
      created: now,
      modified: now,
      accessed: now,
      size: opts.content?.length ?? 0,
    }
    if (type === 'dir') {
      node.children = new Map()
    }
    if (opts.content !== undefined) {
      node.content = opts.content
    }
    if (opts.target) {
      node.target = opts.target
    }
    if (opts.deviceType) {
      node.deviceType = opts.deviceType
      node.major = opts.major
      node.minor = opts.minor
    }
    return node
  }

  private addChild(parent: VNode, child: VNode): VNode {
    parent.children!.set(child.name, child)
    return child
  }

  private addDir(parent: VNode, name: string, opts: Parameters<VirtualFS['mknode']>[2] = {}): VNode {
    return this.addChild(parent, this.mknode(name, 'dir', opts))
  }

  private addFile(parent: VNode, name: string, opts: Parameters<VirtualFS['mknode']>[2] = {}): VNode {
    return this.addChild(parent, this.mknode(name, 'file', opts))
  }

  private addDevice(parent: VNode, name: string, major: number, minor: number): VNode {
    return this.addChild(parent, this.mknode(name, 'device', {
      deviceType: 'char',
      major,
      minor,
      permissions: 0o660,
      group: 'devices',
    }))
  }

  private initializeMounts() {
    this._mounts = [
      { path: '/unproc', type: 'procfs', options: ['ro'] },
      { path: '/undev', type: 'devfs', options: ['rw'] },
      { path: '/untmp', type: 'tmpfs', options: ['rw', 'size=64m'] },
    ]
  }

  // --- Default filesystem hierarchy ---

  // --- Walk/traversal for grep -r and find ---

  walk(path: string, callback: (nodePath: string, node: VNode) => void): void {
    const startNode = this.resolve(path)
    if (!startNode) return
    const absPath = this.resolvePath(path)
    this._walkNode(absPath, startNode, callback)
  }

  private _walkNode(currentPath: string, node: VNode, callback: (nodePath: string, node: VNode) => void): void {
    callback(currentPath, node)
    if (node.type === 'dir' && node.children) {
      for (const [name, child] of node.children) {
        const childPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
        this._walkNode(childPath, child, callback)
      }
    }
  }

  getMounts(): MountPoint[] {
    return [...this._mounts]
  }

  getNodeType(path: string): string | null {
    const node = this.resolve(path)
    if (!node) return null
    if (node.type === 'device') return node.deviceType === 'block' ? 'block device' : 'character device'
    if (node.type === 'symlink') return 'symbolic link'
    if (node.type === 'socket') return 'socket'
    if (node.type === 'dir') return 'directory'
    // Guess from extension/content
    if (node.name.endsWith('.conf') || node.name.endsWith('.cfg')) return 'ASCII text (configuration)'
    if (node.name.endsWith('.sh')) return 'Bourne-Again shell script'
    if (node.name.endsWith('.ko')) return 'ELF kernel module'
    if (node.name.endsWith('.so')) return 'ELF shared object'
    if (node.name.endsWith('.fw')) return 'firmware binary data'
    if (node.name.endsWith('.service')) return 'systemd unit file'
    if (node.name.endsWith('.log')) return 'ASCII text (log file)'
    if (node.name.endsWith('.gz')) return 'gzip compressed data'
    if (node.name.endsWith('.tar')) return 'POSIX tar archive'
    if (node.content?.startsWith('#!/')) return 'executable script'
    if (node.content?.startsWith('<binary>') || node.content?.startsWith('<kernel') || node.content?.startsWith('<firmware')) return 'binary data'
    return 'regular file'
  }

  private buildDefaultTree(): VNode {
    const root = this.mknode('/', 'dir', { permissions: 0o755 })

    this.createUnbin(root)
    this.createUnetc(root)
    this.createUnhome(root)
    this.createUnsrv(root)
    this.createUnusr(root)
    this.createUnvar(root)
    this.createUndev(root)
    this.createUnproc(root)
    this.createUnlib(root)
    this.createUnboot(root)
    this.createUnsys(root)
    this.addDir(root, 'untmp', { permissions: 0o1777 })
    this.addDir(root, 'unmnt')
    this.addDir(root, 'unmedia')

    return root
  }

  private createUnbin(root: VNode) {
    const bin = this.addDir(root, 'unbin')
    const cmds = [
      'ls', 'cd', 'cat', 'mkdir', 'touch', 'rm', 'chmod', 'chown', 'pwd',
      'echo', 'tree', 'clear', 'su', 'sudo', 'passwd', 'id', 'groups',
      'whoami', 'useradd', 'unsh', 'undev', 'unapt', 'unnet',
      // Phase 1: Shell
      'env', 'export', 'unset', 'alias', 'unalias', 'source',
      // Phase 2: Text processing
      'grep', 'find', 'wc', 'sort', 'uniq', 'diff', 'cut', 'tr', 'sed', 'awk', 'tee', 'xargs', 'file', 'strings',
      // Phase 3: System info
      'date', 'cal', 'hostname', 'which', 'df', 'du', 'mount', 'umount', 'lsblk', 'stat', 'man', 'watch',
      // Phase 4: Networking
      'ping', 'curl', 'netstat', 'traceroute', 'dig', 'ip', 'nc', 'ifconfig',
      // Phase 5: Logging
      'journalctl', 'logger', 'crontab',
      // Phase 6: Disk & utils
      'tar', 'gzip', 'mkfs', 'fdisk', 'blkid', 'w', 'last',
      // Phase 7: Remaining
      'basename', 'dirname', 'tty', 'yes',
    ]
    for (const cmd of cmds) {
      this.addFile(bin, cmd, { permissions: 0o755, content: `#!/unbin/unsh\n# ${cmd} - _unOS builtin` })
    }
  }

  private createUnetc(root: VNode) {
    const etc = this.addDir(root, 'unetc')

    // /unetc/unOS config directory
    const etcUnos = this.addDir(etc, 'unOS')
    this.addFile(etcUnos, 'lab.conf', {
      content: [
        '# _unOS Laboratory Configuration',
        `# Generated by _unLAB installer v${UNOS_VERSION}`,
        '',
        '[general]',
        'lab_name = _unLAB',
        'lab_id = UL-0001',
        `version = ${UNOS_VERSION}`,
        'mode = DEVELOPER',
        '',
        '[crystals]',
        'max_crystals = 100',
        'slices_per_crystal = 30',
        'auto_stabilize = true',
        '',
        '[economy]',
        'token = _unSC',
        'mint_cost = 50',
        'network = solana-devnet',
        '',
        '[security]',
        'level = MAXIMUM',
        'encryption = AES-256',
        'session_timeout = 3600',
      ].join('\n'),
    })
    this.addFile(etcUnos, 'blockchain.conf', {
      content: [
        '# Blockchain Configuration',
        '',
        '[network]',
        'chain = solana',
        'cluster = devnet',
        'rpc_url = https://api.devnet.solana.com',
        'ws_url = wss://api.devnet.solana.com',
        '',
        '[volatility]',
        'tracking = enabled',
        'sample_interval = 5000',
        'tier_thresholds = 500,1500,3000,4500',
        '',
        '[tokens]',
        'program_id = UnSC...redacted',
        'mint_authority = system',
      ].join('\n'),
    })
    this.addFile(etcUnos, 'devices.conf', {
      content: [
        '# _unOS Device Configuration',
        '# Auto-generated by device manager',
        '',
        '[devices]',
        'auto_detect = true',
        'power_management = enabled',
        'max_power_draw = 500',
        '',
        '[categories]',
        'crystal = CDC-001',
        'power = UEC-001,MFR-001,BAT-001',
        'audio = HMS-001,ECR-001',
        'compute = SCA-001,AIC-001,IPL-001',
        'quantum = QSM-001,QUA-001,EMC-001',
        'field = EXD-001,VNT-001',
      ].join('\n'),
    })
    this.addFile(etcUnos, 'network.conf', {
      content: [
        '# _unOS Network Configuration',
        '',
        '[interface]',
        'name = uneth0',
        'type = ethernet',
        'hwaddr = UN:OS:00:00:00:01',
        'address = 10.0.0.1',
        'netmask = 255.255.255.0',
        '',
        '[loopback]',
        'name = unlo',
        'address = 127.0.0.1',
      ].join('\n'),
    })
    this.addFile(etcUnos, 'release', {
      content: [
        `DISTRIB_ID=_unOS`,
        `DISTRIB_RELEASE=${UNOS_VERSION}`,
        `DISTRIB_CODENAME=${UNOS_CODENAME}`,
        `DISTRIB_DESCRIPTION="_unOS ${UNOS_VERSION} (${UNOS_CODENAME})"`,
      ].join('\n'),
    })

    // Screw button configs
    const etcScrewButtons = this.addDir(etcUnos, 'screwbuttons')
    for (const [id, conf] of [
      ['sb01', 'SB-01|NODE-SYNC|top-left|enabled'],
      ['sb02', 'SB-02|POOL-LINK|top-right|enabled'],
      ['sb03', 'SB-03|MESH-CAST|bottom-left|enabled'],
      ['sb04', 'SB-04|QUANTUM-BRIDGE|bottom-right|enabled'],
    ]) {
      this.addFile(etcScrewButtons, `${id}.conf`, {
        content: `# Screw Button Configuration\n# Auto-generated by _unOS\n${conf}\n`,
      })
    }

    // unsystemd service directory
    const systemd = this.addDir(etcUnos, 'unsystemd')
    for (const svc of ['und', 'undev', 'unchain', 'untick', 'unnet', 'unpod']) {
      this.addFile(systemd, `${svc}.service`, {
        content: `[Unit]\nDescription=${svc} daemon\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/unbin/${svc}\n\n[Install]\nWantedBy=multi-user.target\n`,
      })
    }

    // System files with un-prefix names
    this.addFile(etc, 'unpasswd', {
      permissions: 0o644,
      content: [
        'root:x:0:0:root:/unhome/root:/unbin/unsh',
        'adm:x:1000:1000:Lab Administrator:/unhome/adm:/unbin/unsh',
        'operator:x:1001:1001:Lab Operator:/unhome/operator:/unbin/unsh',
      ].join('\n'),
    })
    this.addFile(etc, 'unshadow', {
      permissions: 0o600,
      content: [
        'root:$6$rounds=656000$locked::0:99999:7:::',
        'adm:$6$rounds=656000$hashed_placeholder::0:99999:7:::',
        'operator:$6$rounds=656000$hashed_placeholder::0:99999:7:::',
      ].join('\n'),
    })
    this.addFile(etc, 'ungroup', {
      content: [
        'root:x:0:root',
        'wheel:x:10:adm',
        'sudo:x:27:adm',
        'adm:x:1000:adm',
        'operator:x:1001:operator',
        'devices:x:1002:adm,operator',
        'crystals:x:1003:operator',
        'network:x:1004:adm,operator',
        'containers:x:1005:adm',
      ].join('\n'),
    })
    this.addFile(etc, 'unhostname', { content: '_unLAB' })
    this.addFile(etc, 'unmotd', {
      content: [
        '',
        '  ██╗   ██╗███╗   ██╗ ██████╗ ███████╗',
        '  ██║   ██║████╗  ██║██╔═══██╗██╔════╝',
        '  ██║   ██║██╔██╗ ██║██║   ██║███████╗',
        '  ██║   ██║██║╚██╗██║██║   ██║╚════██║',
        '  ╚██████╔╝██║ ╚████║╚██████╔╝███████║',
        '   ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝',
        '',
        `  Welcome to _unOS v${UNOS_VERSION} (${UNOS_CODENAME} Kernel 6.1.0-_unSC)`,
        '  Last login: session start',
        '',
      ].join('\n'),
    })

    // unapt package config
    const apt = this.addDir(etc, 'unapt')
    this.addFile(apt, 'sources.list', {
      content: '# _unOS Package Repositories\ndeb https://repo.unstablelabs.io/unapt stable main\n',
    })
  }

  private createUnhome(root: VNode) {
    const home = this.addDir(root, 'unhome')

    // /unhome/operator
    const opHome = this.addDir(home, 'operator', { owner: 'operator', group: 'operator', permissions: 0o750 })
    this.addFile(opHome, '.unshrc', {
      owner: 'operator', group: 'operator',
      content: '# _unOS operator shell config\nexport PS1="\\u@_unLAB:\\w$ "\nexport PATH=/unbin:/unusr/bin\n',
    })
    this.addFile(opHome, '.unprofile', {
      owner: 'operator', group: 'operator',
      content: '# operator profile\necho "Welcome, operator."\n',
    })

    // .local/docs
    const opLocal = this.addDir(opHome, '.local', { owner: 'operator', group: 'operator' })
    const opLocalDocs = this.addDir(opLocal, 'docs', { owner: 'operator', group: 'operator' })
    this.createDeviceDocs(opLocalDocs)

    const opCrystals = this.addDir(opHome, 'crystals', { owner: 'operator', group: 'operator' })
    this.addFile(opCrystals, '.gitkeep', { owner: 'operator', group: 'operator', content: '' })
    const opScripts = this.addDir(opHome, 'scripts', { owner: 'operator', group: 'operator' })
    this.addFile(opScripts, 'scan.sh', {
      owner: 'operator', group: 'operator', permissions: 0o755,
      content: '#!/unbin/unsh\n# Volatility scanner script\necho "Scanning blockchain for TPS data..."\nscan\n',
    })

    // /unhome/adm
    const admHome = this.addDir(home, 'adm', { owner: 'adm', group: 'adm', permissions: 0o750 })
    this.addFile(admHome, '.unshrc', {
      owner: 'adm', group: 'adm',
      content: '# _unOS admin shell config\nexport PS1="\\u@_unLAB:\\w$ "\nexport PATH=/unbin:/unusr/bin:/unbin\n',
    })
    this.addFile(admHome, '.unprofile', {
      owner: 'adm', group: 'adm',
      content: '# adm profile\necho "Welcome, administrator."\n',
    })
    this.addFile(admHome, 'notes.txt', {
      owner: 'adm', group: 'adm',
      content: '# Admin Notes\n- Root escalation via su requires wheel group membership\n- Monitor /unvar/log/auth.log for unauthorized access\n- Crystal stability reports in /unsrv/_unLAB/reports/\n',
    })

    // /unhome/root
    this.addDir(home, 'root', { permissions: 0o700 })
  }

  private createDeviceDocs(docsDir: VNode) {
    this.addFile(docsDir, 'emc001.txt', {
      owner: 'operator', group: 'operator',
      content: [
        '═══════════════════════════════════════════════════════════',
        '  EMC-001 :: EXOTIC MATTER CONTAINMENT',
        '  Device Specification v4.0',
        '═══════════════════════════════════════════════════════════',
        '',
        'OVERVIEW',
        '  High-energy containment field for exotic matter particles.',
        '  Magnetic confinement system (CERN-class) with real-time',
        '  monitoring of particle count, stability, and field strength.',
        '',
        'SPECIFICATIONS',
        '  Device ID:     EMC-001',
        '  Firmware:      v4.0.1 (build 2026.01.15)',
        '  Checksum:      E8X4M2C7',
        '  Particles:     42 units (max capacity)',
        '  Field Type:    Magnetic confinement',
        '  Temperature:   800-1200°K (operational)',
        '',
        'POWER',
        '  Full:          40 E/s',
        '  Idle:          18 E/s',
        '  Standby:       2 E/s',
        '  Scan/Test:     55 E/s',
        '  Category:      Heavy',
        '  Priority:      P1 (Critical)',
        '',
        'COMMANDS',
        '  emc status           Show containment status',
        '  emc power [on|off]   Power on/off containment field',
        '  emc firmware         View firmware info',
        '  emc firmware update  Check for firmware updates',
        '  emc test             Run containment diagnostics',
        '  emc reset            Reboot containment system',
        '  emc info             Show this documentation',
        '',
        '═══════════════════════════════════════════════════════════',
      ].join('\n'),
    })

    this.addFile(docsDir, 'qsm001.txt', {
      owner: 'operator', group: 'operator',
      content: [
        '═══════════════════════════════════════════════════════════',
        '  QSM-001 :: QUANTUM STATE MONITOR',
        '  Device Specification v1.2',
        '═══════════════════════════════════════════════════════════',
        '',
        'OVERVIEW',
        '  127-qubit quantum coherence monitor with real-time wave',
        '  function visualization. Tracks entanglement state,',
        '  coherence percentage, error rates, and cryogenic temp.',
        '',
        'SPECIFICATIONS',
        '  Device ID:     QSM-001',
        '  Firmware:      v1.2.0 (build 2026.01.20)',
        '  Checksum:      Q7S4M1N9',
        '  Qubit Array:   127 qubits (IBM Eagle topology)',
        '',
        'COMMANDS',
        '  qsm status           Show quantum state',
        '  qsm power [on|off]   Power on/off',
        '  qsm test             Run quantum diagnostics',
        '  qsm reset            Reboot quantum monitor',
        '  qsm info             Show this documentation',
        '',
        '═══════════════════════════════════════════════════════════',
      ].join('\n'),
    })

    this.addFile(docsDir, 'qua001.txt', {
      owner: 'operator', group: 'operator',
      content: [
        '═══════════════════════════════════════════════════════════',
        '  QUA-001 :: QUANTUM ANALYZER',
        '  Device Specification v3.7',
        '═══════════════════════════════════════════════════════════',
        '',
        'OVERVIEW',
        '  Universal problem solver with 6 analysis modes,',
        '  neural network processing, waveform generation,',
        '  and deep scan capability.',
        '',
        'COMMANDS',
        '  qua status              Show analyzer status',
        '  qua power [on|off]      Power on/standby',
        '  qua mode <MODE>         Set analysis mode',
        '  qua test                Run diagnostics',
        '  qua info                Show this documentation',
        '',
        '═══════════════════════════════════════════════════════════',
      ].join('\n'),
    })

    this.addFile(docsDir, 'screwbuttons.txt', {
      owner: 'operator', group: 'operator',
      content: [
        '═══════════════════════════════════════════════════════════',
        '  SCREW BUTTON SYSTEM :: MULTIPLAYER FEATURES',
        '  System Specification v1.0',
        '═══════════════════════════════════════════════════════════',
        '',
        'BUTTONS',
        '  SB-01  Top-Left      NODE-SYNC       Network Node Sync',
        '  SB-02  Top-Right     POOL-LINK       Mining Pool Linkage',
        '  SB-03  Bottom-Left   MESH-CAST       Memetic Broadcasting',
        '  SB-04  Bottom-Right  QUANTUM-BRIDGE  Dimensional Bridge',
        '',
        'COMMANDS',
        '  screwstat              Overview of all screw buttons',
        '  nodesync [sub]         NODE-SYNC control (SB-01)',
        '  poollink [sub]         POOL-LINK control (SB-02)',
        '  meshcast [sub]         MESH-CAST control (SB-03)',
        '  qbridge  [sub]         QUANTUM-BRIDGE control (SB-04)',
        '',
        '═══════════════════════════════════════════════════════════',
      ].join('\n'),
    })
  }

  private createUnsrv(root: VNode) {
    const srv = this.addDir(root, 'unsrv')
    const srvLab = this.addDir(srv, '_unLAB')
    const srvData = this.addDir(srvLab, 'data')
    this.addFile(srvData, '.gitkeep', { content: '' })
    const srvReports = this.addDir(srvLab, 'reports')
    this.addFile(srvReports, 'stability.log', {
      content: '[2026-01-28 00:00:00] Crystal stability check: ALL NOMINAL\n[2026-01-28 00:05:00] Volatility tier: 2 (TPS: 1847)\n',
    })
    this.addDir(srvLab, 'config')
    this.addDir(srvLab, 'crystals')
    this.addDir(srvLab, 'research')
  }

  private createUnusr(root: VNode) {
    const usr = this.addDir(root, 'unusr')
    const usrBin = this.addDir(usr, 'bin')
    this.addFile(usrBin, 'crystal-cli', { permissions: 0o755, content: '#!/unbin/unsh\n# Crystal management CLI\n' })
    const usrLib = this.addDir(usr, 'lib')
    this.addFile(usrLib, 'libcrystal.so', { content: '<binary>' })
    const usrShare = this.addDir(usr, 'share')
    const usrDoc = this.addDir(usrShare, 'doc')
    this.addFile(usrDoc, 'README', { content: `_unOS - Unstable Laboratories Operating System\nVersion ${UNOS_VERSION}\n` })
    this.addDir(usr, 'local')
  }

  private createUnvar(root: VNode) {
    const varDir = this.addDir(root, 'unvar')
    const varLog = this.addDir(varDir, 'log')
    const varLogUnos = this.addDir(varLog, '_unOS')
    this.addFile(varLogUnos, 'system.log', {
      content: '[2026-01-28 00:00:00] _unOS kernel initialized\n[2026-01-28 00:00:01] All subsystems online\n',
    })
    this.addFile(varLogUnos, 'crystal.log', {
      content: '[2026-01-28 00:00:02] Crystal data cache loaded\n',
    })
    this.addFile(varLogUnos, 'screwbutton.log', {
      content: '[2026-01-28 00:00:03] ScrewButton subsystem initialized\n[2026-01-28 00:00:03] 4 buttons registered: SB-01, SB-02, SB-03, SB-04\n',
    })
    this.addFile(varLogUnos, 'network-sync.log', {
      content: '[2026-01-28 00:00:04] Network sync daemon started\n[2026-01-28 00:00:05] Awaiting node-sync activation...\n',
    })
    this.addFile(varLog, 'auth.log', {
      permissions: 0o640,
      content: '[2026-01-28 00:00:00] operator logged in from terminal\n',
    })
    this.addDir(varDir, 'cache')
    this.addDir(varDir, 'run')
    const spool = this.addDir(varDir, 'spool')
    this.addDir(spool, 'cron')
    this.addDir(spool, 'mail')
    const mail = this.addDir(varDir, 'mail')
    this.addFile(mail, 'operator', { owner: 'operator', group: 'operator', content: '' })
  }

  private addBlockDevice(parent: VNode, name: string, major: number, minor: number): VNode {
    return this.addChild(parent, this.mknode(name, 'device', {
      deviceType: 'block',
      major,
      minor,
      permissions: 0o660,
      group: 'devices',
    }))
  }

  private createUndev(root: VNode) {
    const dev = this.addDir(root, 'undev')

    // Standard device nodes
    this.addDevice(dev, 'null', 1, 3)
    this.addDevice(dev, 'zero', 1, 5)
    this.addDevice(dev, 'random', 1, 8)
    this.addDevice(dev, 'urandom', 1, 9)
    this.addDevice(dev, 'tty', 5, 0)
    this.addDevice(dev, 'console', 5, 1)
    this.addDevice(dev, 'ptmx', 5, 2)

    // Block devices
    this.addBlockDevice(dev, 'unsda', 253, 0)
    this.addBlockDevice(dev, 'unsda1', 253, 1)
    this.addBlockDevice(dev, 'unsda2', 253, 2)
    this.addBlockDevice(dev, 'unsdb', 253, 16)

    // PTS directory
    const pts = this.addDir(dev, 'pts')
    this.addDevice(pts, '0', 136, 0)

    // Device subsystem directories
    const crystal = this.addDir(dev, 'crystal', { group: 'devices' })
    this.addDevice(crystal, 'cdc0', 240, 0)

    const power = this.addDir(dev, 'power', { group: 'devices' })
    this.addDevice(power, 'uec0', 241, 0)
    this.addDevice(power, 'mfr0', 241, 1)
    this.addDevice(power, 'bat0', 241, 2)

    const audio = this.addDir(dev, 'audio', { group: 'devices' })
    this.addDevice(audio, 'hms0', 242, 0)
    this.addDevice(audio, 'ecr0', 242, 1)

    const compute = this.addDir(dev, 'compute', { group: 'devices' })
    this.addDevice(compute, 'sca0', 243, 0)
    this.addDevice(compute, 'aic0', 243, 1)
    this.addDevice(compute, 'ipl0', 243, 2)

    const quantum = this.addDir(dev, 'quantum', { group: 'devices' })
    this.addDevice(quantum, 'qsm0', 244, 0)
    this.addDevice(quantum, 'qua0', 244, 1)
    this.addDevice(quantum, 'emc0', 244, 2)

    const field = this.addDir(dev, 'field', { group: 'devices' })
    this.addDevice(field, 'exd0', 245, 0)
    this.addDevice(field, 'vnt0', 245, 1)
  }

  private createUnproc(root: VNode) {
    const proc = this.addDir(root, 'unproc', { permissions: 0o555 })
    this.addFile(proc, 'version', {
      permissions: 0o444,
      content: `_unOS version ${UNOS_VERSION} (${UNOS_CODENAME}) (uncc 12.2.0) #1 SMP PREEMPT_DYNAMIC\n`,
    })
    this.addFile(proc, 'cpuinfo', {
      permissions: 0o444,
      content: [
        'processor\t: 0',
        'vendor_id\t: UnstableLabs',
        'model name\t: _unSC Quantum Core v2',
        'cpu MHz\t\t: 4200.000',
        'cache size\t: 32768 KB',
        'cpu cores\t: 8',
      ].join('\n'),
    })
    this.addFile(proc, 'meminfo', {
      permissions: 0o444,
      content: [
        'MemTotal:       16384000 kB',
        'MemFree:         8192000 kB',
        'MemAvailable:   12288000 kB',
        'Buffers:          512000 kB',
        'Cached:          4096000 kB',
      ].join('\n'),
    })
    this.addFile(proc, 'uptime', {
      permissions: 0o444,
      content: '0.00 0.00\n',
    })
    const sys = this.addDir(proc, 'sys', { permissions: 0o555 })
    const kernel = this.addDir(sys, 'kernel', { permissions: 0o555 })
    this.addFile(kernel, 'hostname', { permissions: 0o444, content: '_unLAB\n' })
    this.addFile(kernel, 'osrelease', { permissions: 0o444, content: `${UNOS_VERSION}\n` })
  }

  private createUnboot(root: VNode) {
    const boot = this.addDir(root, 'unboot')
    this.addFile(boot, 'vmlinuz-6.1.0-_unSC', { permissions: 0o644, content: '<binary: kernel image>' })
    this.addFile(boot, 'initramfs-6.1.0-_unSC.img', { permissions: 0o644, content: '<binary: initramfs>' })
    const grub = this.addDir(boot, 'grub')
    this.addFile(grub, 'grub.cfg', {
      content: [
        '# GRUB Configuration for _unOS',
        'set default=0',
        'set timeout=5',
        '',
        'menuentry "_unOS 2.0.0 (Quantum)" {',
        '  linux /unboot/vmlinuz-6.1.0-_unSC root=/dev/unsda1 ro quiet',
        '  initrd /unboot/initramfs-6.1.0-_unSC.img',
        '}',
      ].join('\n'),
    })
  }

  private createUnsys(root: VNode) {
    const sys = this.addDir(root, 'unsys', { permissions: 0o555 })
    const cls = this.addDir(sys, 'class', { permissions: 0o555 })
    this.addDir(cls, 'net', { permissions: 0o555 })
    this.addDir(cls, 'block', { permissions: 0o555 })
    this.addDir(cls, 'tty', { permissions: 0o555 })
    this.addDir(sys, 'devices', { permissions: 0o555 })
    this.addDir(sys, 'kernel', { permissions: 0o555 })
  }

  private createUnlib(root: VNode) {
    const lib = this.addDir(root, 'unlib')
    const modules = this.addDir(lib, 'modules')
    this.addFile(modules, 'undev.ko', { content: '<kernel module>' })
    this.addFile(modules, 'unchain.ko', { content: '<kernel module>' })
    this.addFile(modules, 'unquantum.ko', { content: '<kernel module>' })
    const firmware = this.addDir(lib, 'firmware')
    this.addFile(firmware, 'devices.fw', { content: '<firmware blob>' })
  }

  // --- Path resolution with alias support ---

  resolvePath(path: string): string {
    // Handle ~ expansion
    if (path === '~') return this.getHomeDirForUser()
    if (path.startsWith('~/')) return this.getHomeDirForUser() + path.slice(1)
    // Handle cd -
    if (path === '-') return this._previousCwd

    let absPath: string
    if (path.startsWith('/')) {
      absPath = path
    } else {
      absPath = this._cwd + '/' + path
    }

    absPath = this.normalizePath(absPath)

    // Apply path aliases: /etc -> /unetc, /home -> /unhome, etc.
    for (const [alias, target] of Object.entries(PATH_ALIASES)) {
      if (absPath === alias || absPath.startsWith(alias + '/')) {
        absPath = target + absPath.slice(alias.length)
        break
      }
    }

    return absPath
  }

  resolve(path: string): VNode | null {
    const absPath = this.resolvePath(path)
    if (absPath === '/') return this.root

    const parts = absPath.split('/').filter(Boolean)
    let current = this.root

    for (const part of parts) {
      if (current.type !== 'dir' || !current.children) return null
      const child = current.children.get(part)
      if (!child) return null
      if (child.type === 'symlink' && child.target) {
        const resolved = this.resolve(child.target)
        if (!resolved) return null
        current = resolved
      } else {
        current = child
      }
    }
    current.accessed = Date.now()
    return current
  }

  toAbsolute(path: string): string {
    return this.resolvePath(path)
  }

  private _homeUser: string = 'operator'
  setHomeUser(username: string) {
    this._homeUser = username
  }

  private getHomeDirForUser(): string {
    return `/unhome/${this._homeUser}`
  }

  private normalizePath(path: string): string {
    const parts = path.split('/').filter(Boolean)
    const resolved: string[] = []
    for (const part of parts) {
      if (part === '.') continue
      if (part === '..') {
        resolved.pop()
      } else {
        resolved.push(part)
      }
    }
    return '/' + resolved.join('/')
  }

  // --- Filesystem operations ---

  checkPermission(node: VNode, user: string, groups: string[], action: 'r' | 'w' | 'x'): boolean {
    if (user === 'root') return true
    const perm = node.permissions
    const bitIndex = action === 'r' ? 2 : action === 'w' ? 1 : 0

    if (node.owner === user) {
      return Boolean((perm >> (6 + bitIndex)) & 1)
    }
    if (groups.includes(node.group)) {
      return Boolean((perm >> (3 + bitIndex)) & 1)
    }
    return Boolean((perm >> bitIndex) & 1)
  }

  formatPermissions(node: VNode): string {
    const typeChar = node.type === 'dir' ? 'd' :
                     node.type === 'symlink' ? 'l' :
                     node.type === 'device' ? 'c' :
                     node.type === 'socket' ? 's' : '-'
    const p = node.permissions
    const bits = [
      (p >> 8) & 1 ? 'r' : '-', (p >> 7) & 1 ? 'w' : '-', (p >> 6) & 1 ? 'x' : '-',
      (p >> 5) & 1 ? 'r' : '-', (p >> 4) & 1 ? 'w' : '-', (p >> 3) & 1 ? 'x' : '-',
      (p >> 2) & 1 ? 'r' : '-', (p >> 1) & 1 ? 'w' : '-', (p >> 0) & 1 ? 'x' : '-',
    ]
    return typeChar + bits.join('')
  }

  ls(path?: string, flags: { long?: boolean; all?: boolean } = {}): string[] {
    const targetPath = path || this._cwd
    const node = this.resolve(targetPath)
    if (!node) return [`ls: cannot access '${targetPath}': No such file or directory`]
    if (node.type !== 'dir') {
      if (flags.long) {
        return [this.formatLongEntry(node)]
      }
      return [node.name]
    }

    const entries = Array.from(node.children!.entries())
      .filter(([name]) => flags.all || !name.startsWith('.'))
      .sort(([a], [b]) => a.localeCompare(b))

    // Merge dynamic procfs entries for /unproc directories
    const absPath = this.resolvePath(targetPath)
    let dynamicNames: string[] = []
    if (absPath.startsWith('/unproc') && this._procfsListDir) {
      const dynEntries = this._procfsListDir(absPath)
      if (dynEntries) {
        const staticNames = new Set(entries.map(([n]) => n))
        dynamicNames = dynEntries.filter(n => !staticNames.has(n))
      }
    }

    if (entries.length === 0 && dynamicNames.length === 0) return []

    if (flags.long) {
      const result = entries.map(([, child]) => this.formatLongEntry(child))
      // Dynamic procfs entries get a simple format
      for (const name of dynamicNames) {
        result.push(`dr-xr-xr-x root       root            0 ${new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })} ${name}/`)
      }
      return result
    }

    const result = entries.map(([, child]) => {
      if (child.type === 'dir') return `${child.name}/`
      if (child.type === 'symlink') return `${child.name}`
      if (child.type === 'device') return `${child.name}`
      if ((child.permissions & 0o111) !== 0) return `${child.name}`
      return child.name
    })

    // Add dynamic procfs directories
    for (const name of dynamicNames) {
      result.push(`${name}/`)
    }

    return result.sort()
  }

  private formatLongEntry(node: VNode): string {
    const perms = this.formatPermissions(node)
    const owner = node.owner.padEnd(10)
    const group = node.group.padEnd(10)
    const size = node.type === 'device'
      ? `${node.major ?? 0}, ${node.minor ?? 0}`.padStart(6)
      : node.size.toString().padStart(6)
    const date = new Date(node.modified).toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    const name = node.type === 'dir' ? `${node.name}/` :
                 node.type === 'symlink' ? `${node.name} -> ${node.target}` :
                 node.type === 'device' ? `${node.name}` :
                 (node.permissions & 0o111) !== 0 ? `${node.name}` :
                 node.name
    return `${perms} ${owner} ${group} ${size} ${date} ${name}`
  }

  cd(path: string): string | null {
    const target = path === '-' ? this._previousCwd : path
    const absPath = this.resolvePath(target)
    const node = this.resolve(absPath)
    if (!node) return `cd: ${path}: No such file or directory`
    if (node.type !== 'dir') return `cd: ${path}: Not a directory`
    this._previousCwd = this._cwd
    this._cwd = absPath
    return null
  }

  pwd(): string {
    return this._cwd
  }

  cat(path: string): string | null {
    // Try dynamic procfs first for /unproc paths
    const absPath = this.resolvePath(path)
    if (absPath.startsWith('/unproc') && this._procfsGenerator) {
      const dynamic = this._procfsGenerator(absPath)
      if (dynamic !== null) return dynamic
    }

    const node = this.resolve(path)
    if (!node) return `cat: ${path}: No such file or directory`
    if (node.type === 'dir') return `cat: ${path}: Is a directory`
    return node.content ?? ''
  }

  mkdir(path: string, parents: boolean = false): string | null {
    const absPath = this.resolvePath(path)
    const parts = absPath.split('/').filter(Boolean)
    let current = this.root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!current.children) return `mkdir: cannot create '${path}': Not a directory`

      const existing = current.children.get(part)
      if (existing) {
        if (existing.type !== 'dir') return `mkdir: cannot create '${path}': File exists`
        if (i === parts.length - 1 && !parents) return `mkdir: cannot create '${path}': File exists`
        current = existing
      } else {
        if (i < parts.length - 1 && !parents) return `mkdir: cannot create '${path}': No such file or directory`
        const newDir = this.mknode(part, 'dir', { owner: this._homeUser, group: this._homeUser })
        this.addChild(current, newDir)
        current = newDir
      }
    }
    return null
  }

  touch(path: string): string | null {
    const absPath = this.resolvePath(path)
    const parts = absPath.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) return `touch: missing file operand`

    const parentPath = '/' + parts.join('/')
    const parent = this.resolve(parentPath)
    if (!parent) return `touch: cannot touch '${path}': No such file or directory`
    if (parent.type !== 'dir') return `touch: cannot touch '${path}': Not a directory`

    const existing = parent.children!.get(fileName)
    if (existing) {
      existing.modified = Date.now()
      return null
    }

    const file = this.mknode(fileName, 'file', { owner: this._homeUser, group: this._homeUser, content: '' })
    this.addChild(parent, file)
    return null
  }

  rm(path: string, recursive: boolean = false): string | null {
    const absPath = this.resolvePath(path)
    if (absPath === '/') return `rm: cannot remove '/': Permission denied`

    const parts = absPath.split('/').filter(Boolean)
    const name = parts.pop()
    if (!name) return `rm: missing operand`

    const parentPath = '/' + parts.join('/')
    const parent = this.resolve(parentPath)
    if (!parent || !parent.children) return `rm: cannot remove '${path}': No such file or directory`

    const target = parent.children.get(name)
    if (!target) return `rm: cannot remove '${path}': No such file or directory`
    if (target.type === 'dir' && !recursive) return `rm: cannot remove '${path}': Is a directory (use -r)`

    parent.children.delete(name)
    return null
  }

  tree(path?: string, depth: number = 3): string[] {
    const targetPath = path || this._cwd
    const node = this.resolve(targetPath)
    if (!node) return [`${targetPath} [error opening dir]`]
    if (node.type !== 'dir') return [node.name]

    const lines: string[] = [targetPath]
    this.buildTree(node, '', depth, lines)
    return lines
  }

  private buildTree(node: VNode, prefix: string, depth: number, lines: string[]): void {
    if (depth <= 0 || node.type !== 'dir' || !node.children) return

    const entries = Array.from(node.children.entries())
      .filter(([name]) => !name.startsWith('.'))
      .sort(([a], [b]) => a.localeCompare(b))

    entries.forEach(([, child], i) => {
      const isLast = i === entries.length - 1
      const connector = isLast ? '└── ' : '├── '
      const name = child.type === 'dir' ? `${child.name}/` :
                   child.type === 'device' ? `${child.name}` :
                   child.name
      lines.push(prefix + connector + name)
      if (child.type === 'dir') {
        this.buildTree(child, prefix + (isLast ? '    ' : '│   '), depth - 1, lines)
      }
    })
  }

  stat(path: string): VNode | null {
    return this.resolve(path)
  }

  chmod(path: string, mode: number): string | null {
    const node = this.resolve(path)
    if (!node) return `chmod: cannot access '${path}': No such file or directory`
    node.permissions = mode
    return null
  }

  chown(path: string, owner: string, group?: string): string | null {
    const node = this.resolve(path)
    if (!node) return `chown: cannot access '${path}': No such file or directory`
    node.owner = owner
    if (group) node.group = group
    return null
  }

  cp(src: string, dest: string, recursive: boolean = false): string | null {
    const srcNode = this.resolve(src)
    if (!srcNode) return `cp: cannot stat '${src}': No such file or directory`
    if (srcNode.type === 'dir' && !recursive) return `cp: -r not specified; omitting directory '${src}'`

    const absDestPath = this.resolvePath(dest)
    const destNode = this.resolve(dest)

    // If dest is a directory, copy into it
    if (destNode && destNode.type === 'dir') {
      const clone = this.cloneNode(srcNode)
      this.addChild(destNode, clone)
      return null
    }

    // Otherwise copy to dest path (rename)
    const parts = absDestPath.split('/').filter(Boolean)
    const newName = parts.pop()
    if (!newName) return `cp: missing destination`
    const parentPath = '/' + parts.join('/')
    const parent = this.resolve(parentPath)
    if (!parent || parent.type !== 'dir') return `cp: cannot create '${dest}': No such file or directory`

    const clone = this.cloneNode(srcNode)
    clone.name = newName
    this.addChild(parent, clone)
    return null
  }

  mv(src: string, dest: string): string | null {
    const cpErr = this.cp(src, dest, true)
    if (cpErr) return cpErr.replace('cp:', 'mv:')
    const rmErr = this.rm(src, true)
    if (rmErr) return rmErr.replace('rm:', 'mv:')
    return null
  }

  ln(target: string, linkName: string, symbolic: boolean = true): string | null {
    if (!symbolic) return `ln: hard links not supported`
    const absLinkPath = this.resolvePath(linkName)
    const parts = absLinkPath.split('/').filter(Boolean)
    const name = parts.pop()
    if (!name) return `ln: missing link name`
    const parentPath = '/' + parts.join('/')
    const parent = this.resolve(parentPath)
    if (!parent || parent.type !== 'dir') return `ln: cannot create '${linkName}': No such file or directory`

    const link = this.mknode(name, 'symlink', {
      owner: this._homeUser,
      group: this._homeUser,
      target: this.resolvePath(target),
    })
    this.addChild(parent, link)
    return null
  }

  head(path: string, lines: number = 10): string | null {
    const content = this.cat(path)
    if (content === null) return null
    return content.split('\n').slice(0, lines).join('\n')
  }

  tail(path: string, lines: number = 10): string | null {
    const content = this.cat(path)
    if (content === null) return null
    const allLines = content.split('\n')
    return allLines.slice(Math.max(0, allLines.length - lines)).join('\n')
  }

  write(path: string, content: string): string | null {
    const node = this.resolve(path)
    if (node) {
      if (node.type === 'dir') return `write: '${path}': Is a directory`
      node.content = content
      node.size = content.length
      node.modified = Date.now()
      return null
    }
    // Create if doesn't exist
    const err = this.touch(path)
    if (err) return err
    const newNode = this.resolve(path)
    if (newNode) {
      newNode.content = content
      newNode.size = content.length
    }
    return null
  }

  private cloneNode(node: VNode): VNode {
    const now = Date.now()
    const clone: VNode = {
      ...node,
      created: now,
      modified: now,
      accessed: now,
    }
    if (node.children) {
      clone.children = new Map()
      for (const [k, v] of node.children) {
        clone.children.set(k, this.cloneNode(v))
      }
    }
    return clone
  }

  // --- Serialization ---

  toJSON(): string {
    return JSON.stringify({
      cwd: this._cwd,
      previousCwd: this._previousCwd,
      homeUser: this._homeUser,
      mounts: this._mounts,
      tree: this.serializeNode(this.root),
    })
  }

  private serializeNode(node: VNode): Record<string, unknown> {
    const obj: Record<string, unknown> = {
      n: node.name,
      t: node.type,
      p: node.permissions,
      o: node.owner,
      g: node.group,
      cr: node.created,
      m: node.modified,
      a: node.accessed,
      s: node.size,
    }
    if (node.content !== undefined) obj.c = node.content
    if (node.target) obj.tg = node.target
    if (node.deviceType) {
      obj.dt = node.deviceType
      obj.mj = node.major
      obj.mn = node.minor
    }
    if (node.children) {
      const ch: Record<string, unknown> = {}
      for (const [k, v] of node.children) {
        ch[k] = this.serializeNode(v)
      }
      obj.ch = ch
    }
    return obj
  }

  private static migratePath(p: string): string {
    // Migrate old /home/ paths to /unhome/
    if (p.startsWith('/home/')) return '/unhome/' + p.slice(6)
    if (p === '/home') return '/unhome'
    return p
  }

  static fromJSON(json: string): VirtualFS {
    const fs = new VirtualFS()
    try {
      const data = JSON.parse(json)
      fs._cwd = VirtualFS.migratePath(data.cwd || '/unhome/operator')
      fs._previousCwd = VirtualFS.migratePath(data.previousCwd || '/unhome/operator')
      fs._homeUser = data.homeUser || 'operator'
      if (data.mounts) fs._mounts = data.mounts
      if (data.tree) {
        fs.root = fs.deserializeNode(data.tree)
      }
      // Validate cwd exists, fall back to home if not
      if (!fs.resolve(fs._cwd)) {
        fs._cwd = `/unhome/${fs._homeUser}`
        if (!fs.resolve(fs._cwd)) {
          fs._cwd = '/'
        }
      }
    } catch {
      // Return default FS on parse error
    }
    return fs
  }

  private deserializeNode(obj: Record<string, unknown>): VNode {
    const now = Date.now()
    const node: VNode = {
      name: obj.n as string,
      type: obj.t as VNode['type'],
      permissions: obj.p as number,
      owner: obj.o as string,
      group: obj.g as string,
      created: (obj.cr as number) ?? now,
      modified: obj.m as number,
      accessed: (obj.a as number) ?? now,
      size: obj.s as number,
    }
    if (obj.c !== undefined) node.content = obj.c as string
    if (obj.tg) node.target = obj.tg as string
    if (obj.dt) {
      node.deviceType = obj.dt as 'char' | 'block'
      node.major = obj.mj as number
      node.minor = obj.mn as number
    }
    if (obj.ch) {
      node.children = new Map()
      for (const [k, v] of Object.entries(obj.ch as Record<string, unknown>)) {
        node.children.set(k, this.deserializeNode(v as Record<string, unknown>))
      }
    }
    return node
  }
}
