# OpenCode Telegram Plugin

Simple Telegram notifications for OpenCode sessions.

## Files

- **`telegram-notify.ts`** - OpenCode plugin for session events
- **`notify.ts`** - Simple system notification plugin (uses `say`)
- **`telegram-bot.ts`** - Telegram bot implementation
- **`package.json`** - Dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration

## Features

- 🕐 Session idle detection and notifications
- 📱 Telegram messages for session events
- 📝 Last message capture and forwarding
- 🚀 Session start/end tracking
- ✅ Task completion notifications
- ❌ Error notifications
- 🛡️ Automatic .env file loading
- 💬 Commands: `/send-last`, `/send-to-phone`

## Usage

### As OpenCode Plugin
```javascript
// The plugin automatically responds to session events
import { TelegramNotify } from "./telegram-notify.js"
```

**Commands you can use in OpenCode:**
- `/send-last` - Send the last message to Telegram
- `/send-to-phone` - Send the last message to your phone
- `/last` - Same as `/send-last`
- `/phone` - Same as `/send-to-phone`

### Standalone Bot
```bash
# Run the bot directly
bun telegram-bot.ts

# Test the plugin
bun telegram-notify.ts
```

### Setup

1. **Create a Telegram Bot**
   - Message @BotFather on Telegram
   - Create a new bot with `/newbot`
   - Save the bot token

2. **Get Your Chat ID**
   - Start a chat with your bot
   - Send a message to the bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your `chat_id` in the response

3. **Configure Environment Variables**
   ```bash
   export TELEGRAM_BOT_TOKEN="your_bot_token_here"
   export TELEGRAM_CHAT_ID="your_chat_id_here"
   ```

4. **Or Update Configuration**
   Edit `.opencode/plugin/telegram-config.json`:
   ```json
   {
     "telegramIdle": {
       "enabled": true,
       "botToken": "your_bot_token_here",
       "chatId": "your_chat_id_here"
     }
   }
   ```

### Usage

The plugin automatically initializes when OpenCode starts. It will:

- Monitor session activity
- Send idle notifications after 5 minutes of inactivity
- Send resume notifications when activity resumes
- Clean up resources on session end

### Customization

You can customize the plugin behavior by modifying the configuration:

- `idleTimeout`: Time in milliseconds before considering session idle
- `checkInterval`: How often to check for idle state
- `messages`: Customize notification messages

### Integration with OpenCode

To integrate this plugin with OpenCode's event system, you would need to:

1. Hook into OpenCode's activity tracking events
2. Call `handleActivity()` when user interacts with OpenCode
3. Call `init()` when OpenCode session starts
4. Call `cleanup()` when OpenCode session ends

### Testing

Test the plugin independently:

```bash
node .opencode/plugin/telegram-idle.js
```

### Troubleshooting

- **"Bot token not configured"**: Set `TELEGRAM_BOT_TOKEN` environment variable
- **"Chat ID not configured"**: Set `TELEGRAM_CHAT_ID` environment variable
- **"Failed to send message"**: Check bot token and chat ID are correct
- **No notifications**: Ensure bot is started and chat is active
