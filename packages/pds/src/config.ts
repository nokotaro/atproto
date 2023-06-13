import { parseIntWithFallback, DAY, HOUR } from '@atproto/common'

export interface ServerConfigValues {
  debugMode?: boolean
  version: string

  publicUrl?: string
  scheme: string
  port?: number
  hostname: string

  dbPostgresUrl?: string
  dbPostgresSchema?: string

  blobstoreLocation?: string
  blobstoreTmp?: string

  jwtSecret: string

  didPlcUrl: string
  didCacheStaleTTL: number
  didCacheMaxTTL: number

  serverDid: string
  recoveryKey: string
  adminPassword: string
  moderatorPassword?: string

  inviteRequired: boolean
  userInviteInterval: number | null
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string

  databaseLocation?: string

  availableUserDomains: string[]

  appUrlPasswordReset: string
  emailSmtpUrl?: string
  emailNoReplyAddress: string

  maxSubscriptionBuffer: number
  repoBackfillLimitMs: number
  sequencerLeaderLockId?: number

  bskyAppViewEndpoint?: string
  bskyAppViewDid?: string

  crawlersToNotify?: string[]
}

export class ServerConfig {
  constructor(private cfg: ServerConfigValues) {
    const invalidDomain = cfg.availableUserDomains.find(
      (domain) => domain.length < 1 || !domain.startsWith('.'),
    )
    if (invalidDomain) {
      throw new Error(`Invalid domain: ${invalidDomain}`)
    }
  }

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const debugMode = process.env.DEBUG_MODE === '1'
    const version = process.env.PDS_VERSION || '0.0.0'

    const publicUrl = process.env.PUBLIC_URL || undefined
    const hostname = process.env.HOSTNAME || 'localhost'
    let scheme
    if ('TLS' in process.env) {
      scheme = process.env.TLS === '1' ? 'https' : 'http'
    } else {
      scheme = hostname === 'localhost' ? 'http' : 'https'
    }
    const port = parseIntWithFallback(process.env.PORT, 2583)

    const jwtSecret = process.env.JWT_SECRET || 'jwt_secret'

    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const didCacheStaleTTL = parseIntWithFallback(
      process.env.DID_CACHE_STALE_TTL,
      HOUR,
    )
    const didCacheMaxTTL = parseIntWithFallback(
      process.env.DID_CACHE_MAX_TTL,
      DAY,
    )

    const serverDid = overrides?.serverDid || process.env.SERVER_DID
    if (typeof serverDid !== 'string') {
      throw new Error('No value provided for process.env.SERVER_DID')
    }

    const recoveryKey = overrides?.recoveryKey || process.env.RECOVERY_KEY
    if (typeof recoveryKey !== 'string') {
      throw new Error('No value provided for process.env.RECOVERY_KEY')
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
    const moderatorPassword = process.env.MODERATOR_PASSWORD || undefined

    const inviteRequired = process.env.INVITE_REQUIRED === 'true' ? true : false
    const userInviteInterval = parseIntWithFallback(
      process.env.USER_INVITE_INTERVAL,
      null,
    )
    const privacyPolicyUrl = process.env.PRIVACY_POLICY_URL
    const termsOfServiceUrl = process.env.TERMS_OF_SERVICE_URL

    const databaseLocation = process.env.DATABASE_LOC

    const blobstoreLocation = process.env.BLOBSTORE_LOC
    const blobstoreTmp = process.env.BLOBSTORE_TMP

    const availableUserDomains = process.env.AVAILABLE_USER_DOMAINS
      ? process.env.AVAILABLE_USER_DOMAINS.split(',')
      : []

    const appUrlPasswordReset =
      process.env.APP_URL_PASSWORD_RESET || 'app://password-reset'

    const emailSmtpUrl = process.env.EMAIL_SMTP_URL || undefined

    const emailNoReplyAddress =
      process.env.EMAIL_NO_REPLY_ADDRESS || 'noreply@blueskyweb.xyz'

    const dbPostgresUrl = process.env.DB_POSTGRES_URL
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA

    const maxSubscriptionBuffer = parseIntWithFallback(
      process.env.MAX_SUBSCRIPTION_BUFFER,
      500,
    )

    const repoBackfillLimitMs = parseIntWithFallback(
      process.env.REPO_BACKFILL_LIMIT_MS,
      DAY,
    )

    const sequencerLeaderLockId = parseIntWithFallback(
      process.env.SEQUENCER_LEADER_LOCK_ID,
      undefined,
    )

    const bskyAppViewEndpoint = nonemptyString(
      process.env.BSKY_APP_VIEW_ENDPOINT,
    )
    const bskyAppViewDid = nonemptyString(process.env.BSKY_APP_VIEW_DID)

    const crawlersEnv = process.env.CRAWLERS_TO_NOTIFY
    const crawlersToNotify =
      crawlersEnv && crawlersEnv.length > 0 ? crawlersEnv.split(',') : []

    return new ServerConfig({
      debugMode,
      version,
      publicUrl,
      scheme,
      hostname,
      port,
      dbPostgresUrl,
      dbPostgresSchema,
      blobstoreLocation,
      blobstoreTmp,
      jwtSecret,
      recoveryKey,
      didPlcUrl,
      didCacheStaleTTL,
      didCacheMaxTTL,
      serverDid,
      adminPassword,
      moderatorPassword,
      inviteRequired,
      userInviteInterval,
      privacyPolicyUrl,
      termsOfServiceUrl,
      databaseLocation,
      availableUserDomains,
      appUrlPasswordReset,
      emailSmtpUrl,
      emailNoReplyAddress,
      maxSubscriptionBuffer,
      repoBackfillLimitMs,
      sequencerLeaderLockId,
      bskyAppViewEndpoint,
      bskyAppViewDid,
      crawlersToNotify,
      ...overrides,
    })
  }

  get debugMode() {
    return !!this.cfg.debugMode
  }

  get version() {
    return this.cfg.version
  }

  get scheme() {
    return this.cfg.scheme
  }

  get port() {
    return this.cfg.port
  }

  get hostname() {
    return this.cfg.hostname
  }

  get internalUrl() {
    return `${this.scheme}://${this.hostname}:${this.port}`
  }

  get origin() {
    const u = new URL(this.internalUrl)
    return u.origin
  }

  get publicUrl() {
    return this.cfg.publicUrl || this.internalUrl
  }

  get publicHostname() {
    const u = new URL(this.publicUrl)
    return u.hostname
  }

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get blobstoreLocation() {
    return this.cfg.blobstoreLocation
  }

  get blobstoreTmp() {
    return this.cfg.blobstoreTmp
  }

  get jwtSecret() {
    return this.cfg.jwtSecret
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get didCacheStaleTTL() {
    return this.cfg.didCacheStaleTTL
  }

  get didCacheMaxTTL() {
    return this.cfg.didCacheMaxTTL
  }

  get serverDid() {
    return this.cfg.serverDid
  }

  get recoveryKey() {
    return this.cfg.recoveryKey
  }

  get adminPassword() {
    return this.cfg.adminPassword
  }

  get moderatorPassword() {
    return this.cfg.moderatorPassword
  }

  get inviteRequired() {
    return this.cfg.inviteRequired
  }

  get userInviteInterval() {
    return this.cfg.userInviteInterval
  }

  get privacyPolicyUrl() {
    if (
      this.cfg.privacyPolicyUrl &&
      this.cfg.privacyPolicyUrl.startsWith('/')
    ) {
      return this.publicUrl + this.cfg.privacyPolicyUrl
    }
    return this.cfg.privacyPolicyUrl
  }

  get termsOfServiceUrl() {
    if (
      this.cfg.termsOfServiceUrl &&
      this.cfg.termsOfServiceUrl.startsWith('/')
    ) {
      return this.publicUrl + this.cfg.termsOfServiceUrl
    }
    return this.cfg.termsOfServiceUrl
  }

  get databaseLocation() {
    return this.cfg.databaseLocation
  }

  get useMemoryDatabase() {
    return !this.databaseLocation
  }

  get availableUserDomains() {
    return this.cfg.availableUserDomains
  }

  get appUrlPasswordReset() {
    return this.cfg.appUrlPasswordReset
  }

  get emailSmtpUrl() {
    return this.cfg.emailSmtpUrl
  }

  get emailNoReplyAddress() {
    return this.cfg.emailNoReplyAddress
  }

  get maxSubscriptionBuffer() {
    return this.cfg.maxSubscriptionBuffer
  }

  get repoBackfillLimitMs() {
    return this.cfg.repoBackfillLimitMs
  }

  get sequencerLeaderLockId() {
    return this.cfg.sequencerLeaderLockId
  }

  get bskyAppViewEndpoint() {
    return this.cfg.bskyAppViewEndpoint
  }

  get bskyAppViewDid() {
    return this.cfg.bskyAppViewDid
  }

  get crawlersToNotify() {
    return this.cfg.crawlersToNotify
  }
}

const nonemptyString = (str: string | undefined): string | undefined => {
  if (str === undefined || str.length === 0) return undefined
  return str
}
