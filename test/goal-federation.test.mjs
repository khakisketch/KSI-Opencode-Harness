import test from "node:test"
import assert from "node:assert/strict"
import plugin from "../index.mjs"

const {
  GOAL_READ_TOOLS,
  GOAL_WRITE_TOOLS,
  PLAN_PERMISSION,
  BUILD_PERMISSION,
  DESIGN_PERMISSION,
  ROLES,
  rolePermission,
} = await import("../src/agents.mjs")

const ALL_GOAL_TOOLS = [...GOAL_READ_TOOLS, ...GOAL_WRITE_TOOLS]
const goalLikeKeys = (permission) =>
  Object.keys(permission ?? {}).filter((key) => key.toLowerCase().includes("goal")).sort()

async function effectiveConfig() {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  return config
}

test("exports the exact approved goal tool IDs", () => {
  assert.deepStrictEqual(GOAL_READ_TOOLS, ["get_goal", "get_goal_history", "list_all_goals"])
  assert.deepStrictEqual(GOAL_WRITE_TOOLS, [
    "create_goal",
    "set_goal",
    "update_goal_objective",
    "update_goal",
    "update_goal_status",
    "clear_goal",
  ])
})

test("direct permissions grant exactly the approved goal keys (closed world)", () => {
  assert.deepStrictEqual(goalLikeKeys(PLAN_PERMISSION), [...GOAL_READ_TOOLS].sort())
  assert.deepStrictEqual(goalLikeKeys(BUILD_PERMISSION), [...ALL_GOAL_TOOLS].sort())
  assert.deepStrictEqual(goalLikeKeys(DESIGN_PERMISSION), [])
  for (const name of ROLES) {
    assert.deepStrictEqual(goalLikeKeys(rolePermission(name)), [], `${name} must not grant goal tools`)
  }
  for (const name of GOAL_READ_TOOLS) {
    assert.equal(PLAN_PERMISSION[name], "allow", `${name} not granted in PLAN`)
    assert.equal(BUILD_PERMISSION[name], "allow", `${name} not granted in BUILD`)
  }
  for (const name of GOAL_WRITE_TOOLS) {
    assert.equal(BUILD_PERMISSION[name], "allow", `${name} not granted in BUILD`)
    assert.ok(
      PLAN_PERMISSION[name] === undefined || PLAN_PERMISSION[name] === "deny",
      `${name} must be denied/absent in PLAN`,
    )
  }
  for (const name of ALL_GOAL_TOOLS) {
    assert.ok(
      DESIGN_PERMISSION[name] === undefined || DESIGN_PERMISSION[name] === "deny",
      `${name} must be denied/absent in DESIGN`,
    )
  }
})

test("effective config grants goal tools to build/plan only, never roles or design", async () => {
  const config = await effectiveConfig()
  const plan = config.agent.plan.permission
  const build = config.agent.build.permission
  const design = config.agent.design.permission
  assert.deepStrictEqual(goalLikeKeys(plan), [...GOAL_READ_TOOLS].sort())
  assert.deepStrictEqual(goalLikeKeys(build), [...ALL_GOAL_TOOLS].sort())
  assert.deepStrictEqual(goalLikeKeys(design), [])
  for (const name of GOAL_READ_TOOLS) {
    assert.equal(plan[name], "allow", `${name} not granted in effective PLAN`)
    assert.equal(build[name], "allow", `${name} not granted in effective BUILD`)
  }
  for (const name of GOAL_WRITE_TOOLS) {
    assert.equal(build[name], "allow", `${name} not granted in effective BUILD`)
    assert.ok(
      plan[name] === undefined || plan[name] === "deny",
      `${name} must be denied/absent in effective PLAN`,
    )
  }
  for (const name of ALL_GOAL_TOOLS) {
    assert.ok(
      design[name] === undefined || design[name] === "deny",
      `${name} must be denied/absent in effective DESIGN`,
    )
  }
  for (const name of ROLES) {
    const permission = config.agent[name].permission
    assert.deepStrictEqual(goalLikeKeys(permission), [], `${name} must not grant goal tools`)
    for (const tool of ALL_GOAL_TOOLS) {
      assert.ok(
        permission[tool] === undefined || permission[tool] === "deny",
        `${tool} must be denied/absent in ${name}`,
      )
    }
  }
})

test("PLAN and BUILD keep wildcard deny", () => {
  assert.equal(PLAN_PERMISSION["*"], "deny")
  assert.equal(BUILD_PERMISSION["*"], "deny")
})
