import { Plugin } from '@opencode/plugin'
import { Rpc } from '@opencode/plugin/rpc'
import { annotate } from './status.mjs'

// Only the read method is needed. Native owns storage, execution and lifecycle.
const Goal = Rpc.define({
  id: 'opencode.goal',
  methods: { get: {
    input: { type: 'object', properties: { sessionID: { type: 'string' } }, required: ['sessionID'] },
    output: {},
  } },
  events: {},
})

export default Plugin.define({
  id: 'ksi.native-lead-goal-status',
  async setup(ctx) {
    const goal = ctx.rpc(Goal)
    await ctx.tool.hook('execute.after', event => annotate(event, {
      getSession: sessionID => ctx.session.get({ sessionID }),
      getGoal: sessionID => goal.get({ sessionID }),
    }))
  },
})
