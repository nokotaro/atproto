import fs from 'fs/promises'
import { CID } from 'multiformats/cid'
import AtpAgent from '@atproto/api'
import { AtUri } from '@atproto/uri'
import { BlobRef } from '@atproto/lexicon'
import { Main as Facet } from '@atproto/api/src/client/types/app/bsky/richtext/facet'
import { InputSchema as TakeActionInput } from '@atproto/api/src/client/types/com/atproto/admin/takeModerationAction'
import { InputSchema as CreateReportInput } from '@atproto/api/src/client/types/com/atproto/moderation/createReport'
import { Record as PostRecord } from '@atproto/api/src/client/types/app/bsky/feed/post'
import { Record as LikeRecord } from '@atproto/api/src/client/types/app/bsky/feed/like'
import { Record as FollowRecord } from '@atproto/api/src/client/types/app/bsky/graph/follow'

// Makes it simple to create data via the XRPC client,
// and keeps track of all created data in memory for convenience.

let AVATAR_IMG: Uint8Array | undefined

export type ImageRef = {
  image: BlobRef
  alt: string
}

export class RecordRef {
  uri: AtUri
  cid: CID

  constructor(uri: AtUri | string, cid: CID | string) {
    this.uri = new AtUri(uri.toString())
    this.cid = CID.parse(cid.toString())
  }

  get raw(): { uri: string; cid: string } {
    return {
      uri: this.uri.toString(),
      cid: this.cid.toString(),
    }
  }

  get uriStr(): string {
    return this.uri.toString()
  }

  get cidStr(): string {
    return this.cid.toString()
  }
}

export class SeedClient {
  accounts: Record<
    string,
    {
      did: string
      accessJwt: string
      refreshJwt: string
      handle: string
      email: string
      password: string
    }
  >
  profiles: Record<
    string,
    {
      displayName: string
      description: string
      avatar: { cid: string; mimeType: string }
      ref: RecordRef
    }
  >
  follows: Record<string, Record<string, RecordRef>>
  posts: Record<
    string,
    { text: string; ref: RecordRef; images: ImageRef[]; quote?: RecordRef }[]
  >
  likes: Record<string, Record<string, AtUri>>
  replies: Record<string, { text: string; ref: RecordRef }[]>
  reposts: Record<string, RecordRef[]>
  dids: Record<string, string>

  constructor(public agent: AtpAgent, public adminAuth?: string) {
    this.accounts = {}
    this.profiles = {}
    this.follows = {}
    this.posts = {}
    this.likes = {}
    this.replies = {}
    this.reposts = {}
    this.dids = {}
  }

  async createAccount(
    shortName: string,
    params: {
      handle: string
      email: string
      password: string
    },
  ) {
    const { data: account } =
      await this.agent.api.com.atproto.server.createAccount(params)
    this.dids[shortName] = account.did
    this.accounts[account.did] = {
      ...account,
      email: params.email,
      password: params.password,
    }
    return this.accounts[account.did]
  }

  async updateHandle(by: string, handle: string) {
    await this.agent.api.com.atproto.identity.updateHandle(
      { handle },
      { encoding: 'application/json', headers: this.getHeaders(by) },
    )
  }

  async createProfile(
    by: string,
    displayName: string,
    description: string,
    fromUser?: string,
  ) {
    AVATAR_IMG ??= await fs.readFile(
      'tests/image/fixtures/key-portrait-small.jpg',
    )

    let avatarBlob
    {
      const res = await this.agent.api.com.atproto.repo.uploadBlob(AVATAR_IMG, {
        encoding: 'image/jpeg',
        headers: this.getHeaders(fromUser || by),
      } as any)
      avatarBlob = res.data.blob
    }

    {
      const res = await this.agent.api.app.bsky.actor.profile.create(
        { repo: by },
        {
          displayName,
          description,
          avatar: avatarBlob,
        },
        this.getHeaders(fromUser || by),
      )
      this.profiles[by] = {
        displayName,
        description,
        avatar: avatarBlob,
        ref: new RecordRef(res.uri, res.cid),
      }
    }
    return this.profiles[by]
  }

  async follow(from: string, to: string, overrides?: Partial<FollowRecord>) {
    const res = await this.agent.api.app.bsky.graph.follow.create(
      { repo: from },
      {
        subject: to,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(from),
    )
    this.follows[from] ??= {}
    this.follows[from][to] = new RecordRef(res.uri, res.cid)
    return this.follows[from][to]
  }

  async unfollow(from: string, to: string) {
    const follow = this.follows[from][to]
    if (!follow) {
      throw new Error('follow does not exist')
    }
    await this.agent.api.app.bsky.graph.follow.delete(
      { repo: from, rkey: follow.uri.rkey },
      this.getHeaders(from),
    )
    delete this.follows[from][to]
  }

  async post(
    by: string,
    text: string,
    facets?: Facet[],
    images?: ImageRef[],
    quote?: RecordRef,
    overrides?: Partial<PostRecord>,
  ) {
    const imageEmbed = images && {
      $type: 'app.bsky.embed.images',
      images,
    }
    const recordEmbed = quote && {
      record: { uri: quote.uriStr, cid: quote.cidStr },
    }
    const embed =
      imageEmbed && recordEmbed
        ? {
            $type: 'app.bsky.embed.recordWithMedia',
            record: recordEmbed,
            media: imageEmbed,
          }
        : recordEmbed
        ? { $type: 'app.bsky.embed.record', ...recordEmbed }
        : imageEmbed
    const res = await this.agent.api.app.bsky.feed.post.create(
      { repo: by },
      {
        text: text,
        facets,
        embed,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(by),
    )
    this.posts[by] ??= []
    const post = {
      text,
      ref: new RecordRef(res.uri, res.cid),
      images: images ?? [],
      quote,
    }
    this.posts[by].push(post)
    return post
  }

  async deletePost(by: string, uri: AtUri) {
    await this.agent.api.app.bsky.feed.post.delete(
      {
        repo: by,
        rkey: uri.rkey,
      },
      this.getHeaders(by),
    )
  }

  async uploadFile(
    by: string,
    filePath: string,
    encoding: string,
  ): Promise<ImageRef> {
    const file = await fs.readFile(filePath)
    const res = await this.agent.api.com.atproto.repo.uploadBlob(file, {
      headers: this.getHeaders(by),
      encoding,
    } as any)
    return { image: res.data.blob, alt: filePath }
  }

  async like(by: string, subject: RecordRef, overrides?: Partial<LikeRecord>) {
    const res = await this.agent.api.app.bsky.feed.like.create(
      { repo: by },
      {
        subject: subject.raw,
        createdAt: new Date().toISOString(),
        ...overrides,
      },
      this.getHeaders(by),
    )
    this.likes[by] ??= {}
    this.likes[by][subject.uriStr] = new AtUri(res.uri)
    return this.likes[by][subject.uriStr]
  }

  async reply(
    by: string,
    root: RecordRef,
    parent: RecordRef,
    text: string,
    facets?: Facet[],
    images?: ImageRef[],
  ) {
    const embed = images
      ? {
          $type: 'app.bsky.embed.images',
          images,
        }
      : undefined
    const res = await this.agent.api.app.bsky.feed.post.create(
      { repo: by },
      {
        text: text,
        reply: {
          root: root.raw,
          parent: parent.raw,
        },
        facets,
        embed,
        createdAt: new Date().toISOString(),
      },
      this.getHeaders(by),
    )
    this.replies[by] ??= []
    const reply = {
      text,
      ref: new RecordRef(res.uri, res.cid),
    }
    this.replies[by].push(reply)
    return reply
  }

  async repost(by: string, subject: RecordRef) {
    const res = await this.agent.api.app.bsky.feed.repost.create(
      { repo: by },
      { subject: subject.raw, createdAt: new Date().toISOString() },
      this.getHeaders(by),
    )
    this.reposts[by] ??= []
    const repost = new RecordRef(res.uri, res.cid)
    this.reposts[by].push(repost)
    return repost
  }

  async takeModerationAction(opts: {
    action: TakeActionInput['action']
    subject: TakeActionInput['subject']
    reason?: string
    createdBy?: string
  }) {
    if (!this.adminAuth) {
      throw new Error('No admin auth provided to seed client')
    }
    const {
      action,
      subject,
      reason = 'X',
      createdBy = 'did:example:admin',
    } = opts
    const result = await this.agent.api.com.atproto.admin.takeModerationAction(
      { action, subject, createdBy, reason },
      {
        encoding: 'application/json',
        headers: { authorization: this.adminAuth },
      },
    )
    return result.data
  }

  async reverseModerationAction(opts: {
    id: number
    reason?: string
    createdBy?: string
  }) {
    if (!this.adminAuth) {
      throw new Error('No admin auth provided to seed client')
    }

    const { id, reason = 'X', createdBy = 'did:example:admin' } = opts
    const result =
      await this.agent.api.com.atproto.admin.reverseModerationAction(
        { id, reason, createdBy },
        {
          encoding: 'application/json',
          headers: { authorization: this.adminAuth },
        },
      )
    return result.data
  }

  async resolveReports(opts: {
    actionId: number
    reportIds: number[]
    createdBy?: string
  }) {
    if (!this.adminAuth) {
      throw new Error('No admin auth provided to seed client')
    }

    const { actionId, reportIds, createdBy = 'did:example:admin' } = opts
    const result =
      await this.agent.api.com.atproto.admin.resolveModerationReports(
        { actionId, createdBy, reportIds },
        {
          encoding: 'application/json',
          headers: { authorization: this.adminAuth },
        },
      )
    return result.data
  }

  async createReport(opts: {
    reasonType: CreateReportInput['reasonType']
    subject: CreateReportInput['subject']
    reason?: string
    reportedBy: string
  }) {
    const { reasonType, subject, reason, reportedBy } = opts
    const result = await this.agent.api.com.atproto.moderation.createReport(
      { reasonType, subject, reason },
      {
        encoding: 'application/json',
        headers: this.getHeaders(reportedBy),
      },
    )
    return result.data
  }

  getHeaders(did: string) {
    return SeedClient.getHeaders(this.accounts[did].accessJwt)
  }

  static getHeaders(jwt: string) {
    return { authorization: `Bearer ${jwt}` }
  }
}
