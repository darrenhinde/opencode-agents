import { tool } from "@opencode-ai/plugin/tool"

async function parseImageInput(input: string) {
  // Accepts file path ("./img.png") or data URL ("data:image/png;base64,...")
  if (input.startsWith("data:")) {
    const base64 = input.split(",")[1]
    const mime = input.substring(5, input.indexOf(";"))
    return { mime, base64 }
  }
  // Treat as file path
  const file = Bun.file(input)
  const arr = await file.arrayBuffer()
  const base64 = Buffer.from(arr).toString("base64")
  // Best-effort mime
  const mime = file.type || "image/png"
  return { mime, base64 }
}

export default tool({
  description: "Edit an image using Gemini. Pass file path or data URL.",
  args: {
    image: tool.schema.string().describe("File path or data URL"),
    prompt: tool.schema.string().describe("Edit instruction"),
    output: tool.schema.string().optional().describe("Output filename (default edited.png)"),
  },
  async execute(args, context) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return "Set GEMINI_API_KEY in your environment"

    const { mime, base64 } = await parseImageInput(args.image)
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          inputs: [{ mimeType: mime, data: base64 }],
          contents: [{ parts: [{ text: args.prompt }]}],
        }),
      }
    )

    if (!res.ok) return `API error: ${await res.text()}`
    const json = await res.json()
    const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!b64) return "No image data returned"

    const out = args.output || "edited.png"
    await Bun.write(out, Buffer.from(b64, "base64"))
    return `Saved ${out}`
  },
})