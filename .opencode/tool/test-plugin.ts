import * as plugin from "@opencode-ai/plugin"

console.log("Available exports:", Object.keys(plugin))

// Try to import tool
try {
  const { tool } = await import("@opencode-ai/plugin")
  console.log("Tool function:", typeof tool)
} catch (e) {
  console.log("Tool import error:", e.message)
}