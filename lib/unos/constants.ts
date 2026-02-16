// _unOS v2.0 — Path constants and aliases

export const UNOS_VERSION = '2.0.0'
export const UNOS_CODENAME = 'Quantum'

export const UNOS_PATHS = {
  ROOT: '/',
  BIN: '/unbin',
  ETC: '/unetc',
  VAR: '/unvar',
  LIB: '/unlib',
  USR: '/unusr',
  SRV: '/unsrv',
  HOME: '/unhome',
  DEV: '/undev',
  PROC: '/unproc',
  TMP: '/untmp',
  MNT: '/unmnt',
  UNOS_CONFIG: '/unetc/unOS',
  LAB_CONFIG: '/unetc/unOS/lab.conf',
  DEVICE_CONFIG: '/unetc/unOS/devices.conf',
  NETWORK_CONFIG: '/unetc/unOS/network.conf',
  PASSWD: '/unetc/unpasswd',
  SHADOW: '/unetc/unshadow',
  GROUP: '/unetc/ungroup',
  HOSTNAME: '/unetc/unhostname',
  MOTD: '/unetc/unmotd',
  SYSTEMD: '/unetc/unsystemd',
  APT_CONFIG: '/unetc/unapt',
  RUN: '/unvar/run',
  LOG: '/unvar/log',
  CACHE: '/unvar/cache',
  LAB_DATA: '/unsrv/_unLAB',
  CRYSTALS: '/unsrv/_unLAB/crystals',
  RESEARCH: '/unsrv/_unLAB/research',
} as const

export const PATH_ALIASES: Record<string, string> = {
  '/etc': '/unetc',
  '/var': '/unvar',
  '/lib': '/unlib',
  '/usr': '/unusr',
  '/srv': '/unsrv',
  '/home': '/unhome',
  '/dev': '/undev',
  '/proc': '/unproc',
  '/tmp': '/untmp',
  '/mnt': '/unmnt',
  '/bin': '/unbin',
  '/sbin': '/unbin',
  '/opt': '/unusr/local',
  '/root': '/unhome/root',
  '/boot': '/unboot',
  '/sys': '/unsys',
  '/media': '/unmedia',
}

export const DEVICE_IDS = [
  'UEC-001', 'MFR-001', 'BAT-001', 'CDC-001',
  'HMS-001', 'ECR-001', 'IPL-001', 'AIC-001',
  'VNT-001', 'SCA-001', 'EXD-001', 'QSM-001',
  'EMC-001', 'QUA-001',
] as const

export const DEVICE_CATEGORIES = {
  crystal: ['CDC-001'],
  power: ['UEC-001', 'MFR-001', 'BAT-001'],
  audio: ['HMS-001', 'ECR-001'],
  compute: ['SCA-001', 'AIC-001', 'IPL-001'],
  quantum: ['QSM-001', 'QUA-001', 'EMC-001'],
  field: ['EXD-001', 'VNT-001'],
} as const

export type DeviceCategory = keyof typeof DEVICE_CATEGORIES
