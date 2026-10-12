// The crew: five roles, the agent each one is, what it runs on and the colour it is drawn in.

export const ROLES = ['architect', 'investigator', 'engineer', 'builder', 'runner'] as const
export type Role = (typeof ROLES)[number]

type RoleInfo = { color: string; runsOn: string }

const ROLE_INFO: Record<Role | 'explore' | 'other', RoleInfo> = {
  architect: { color: '#8b7cf6', runsOn: 'Fable · high' },
  investigator: { color: '#e0703a', runsOn: 'Opus · xhigh' },
  engineer: { color: '#d39a1c', runsOn: 'Opus · high' },
  builder: { color: '#3f8fe0', runsOn: 'Opus · medium' },
  runner: { color: '#26a37a', runsOn: 'Opus · low' },
  explore: { color: '#7d8b99', runsOn: '' },
  other: { color: '#8a8a86', runsOn: '' },
}

const CREW_PREFIX = /^(?:[a-z0-9-]+:)?crew-/i

/** A crew agent type: `crew-engineer`, or `cgp-crew:crew-engineer` as the plugin lists it. */
export const isCrew = (agentType: string): boolean => CREW_PREFIX.test(agentType)

const asRole = (name: string): string => {
  const bare = name.trim().toLowerCase().replace(CREW_PREFIX, '')
  return (ROLES as readonly string[]).includes(bare) ? bare : 'other'
}

/** The role of a running agent; anything outside the crew is `other`. */
export const roleOf = (agentType: string): string => (isCrew(agentType) ? asRole(agentType) : 'other')

/** The role a plan names for a task, written `engineer`, `crew-engineer` or `cgp-crew:crew-engineer`. */
export const plannedRole = (name: string | undefined): string => asRole(name ?? '')

/** The symbol an agent draws with: its role, Claude Code's own Explore scout, or `other`. */
export const symbolOf = (agentType: string): string => (agentType === 'Explore' ? 'explore' : roleOf(agentType))

export const colorOf = (role: string): string => (ROLE_INFO[role as Role] ?? ROLE_INFO.other).color

export const runsOn = (role: string): string => (ROLE_INFO[role as Role] ?? ROLE_INFO.other).runsOn
