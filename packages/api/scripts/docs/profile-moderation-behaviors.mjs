import * as url from 'url'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { stripIndents } from 'common-tags'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const profileModerationBehaviorsDef = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      'definitions',
      'profile-moderation-behaviors.json',
    ),
    'utf8',
  ),
)

writeFileSync(
  join(__dirname, '..', '..', 'docs', 'moderation-behaviors', 'profiles.md'),
  profiles(),
  'utf8',
)

function profiles() {
  let lastTitle = 'NULL'
  return stripIndents`
  <!-- this doc is generated by ./scripts/docs/profile-moderation-behaviors.mjs -->

  # Profile moderation behaviors
  
  This document is a reference for the expected behaviors for a profile in the application based on some given scenarios. The <code>moderateProfile()</code> command condense down to the following yes or no decisions:

  - <code>res.account.filter</code> Do not show the account in feeds.
  - <code>res.account.blur</code> Put the account (in listings, when viewing) behind a warning cover.
  - <code>res.account.noOverride</code> Do not allow the account's blur cover to be lifted.
  - <code>res.account.alert</code> Add a warning to the account but do not cover it.
  - <code>res.profile.blur</code> Put the profile details (handle, display name, bio) behind a warning cover.
  - <code>res.profile.noOverride</code> Do not allow the profile's blur cover to be lifted.
  - <code>res.profile.alert</code> Add a warning to the profile but do not cover it.
  - <code>res.avatar.blur</code> Put the avatar behind a cover.
  - <code>res.avatar.noOverride</code> Do not allow the avatars's blur cover to be lifted.
  - <code>res.avatar.alert</code> Put a warning icon on the avatar.
 
  Key:

  - ❌ = Filter Content
  - 🚫 = Blur (no-override)
  - ✋ = Blur
  - 🪧 = Alert

  ## Scenarios

  <table>
    ${Array.from(Object.entries(profileModerationBehaviorsDef.scenarios))
      .map(([title, scenario], i) => {
        const str = `
          ${title.indexOf(lastTitle) === -1 ? postTableHead() : ''}
          ${scenarioSection(title, scenario)}
        `
        lastTitle = title.slice(0, 10)
        return str
      })
      .join('\n\n')}
  </table>
  `
}

function postTableHead() {
  return `<tr><th>Scenario</th><th>Filter</th><th>Account</th><th>Profile</td><th>Avatar</th></tr>`
}

function scenarioSection(title, scenario) {
  return stripIndents`
  <tr>
    <td><strong>${title}</strong></td>
    <td>
      ${filter(scenario.behaviors.account?.filter)}
    </td>
    <td>
      ${blur(
        scenario.behaviors.account?.blur,
        scenario.behaviors.account?.noOverride,
      )}
      ${alert(scenario.behaviors.account?.alert)}
    </td>
    <td>
      ${blur(
        scenario.behaviors.profile?.blur,
        scenario.behaviors.profile?.noOverride,
      )}
      ${alert(scenario.behaviors.profile?.alert)}
    </td>
    <td>
      ${blur(
        scenario.behaviors.avatar?.blur,
        scenario.behaviors.avatar?.noOverride,
      )}
      ${alert(scenario.behaviors.avatar?.alert)}
    </td>
  </tr>
  `
}

function filter(val) {
  return val ? '❌' : ''
}

function blur(val, noOverride) {
  if (val) {
    return noOverride ? '🚫' : '✋'
  }
  return ''
}

function alert(val) {
  return val ? '🪧' : ''
}

export {}
