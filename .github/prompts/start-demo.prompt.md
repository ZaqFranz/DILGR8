---
name: "Start Demo System"
description: "Start the DILGR8RSP backend and frontend for a local demo, then report the URLs and ports."
argument-hint: "Optional demo notes or environment requirements"
agent: "agent"
---
Start the DILGR8RSP demo environment from the workspace root.

1. Inspect the repository scripts and environment examples before starting. Use the existing workspace commands:
   - `npm run dev:backend`
   - `npm run dev:frontend`
2. Confirm dependencies and required environment configuration are available. Do not print secrets or ask the user to provide secrets in chat.
3. Start the backend and frontend as separate long-running terminal processes. Preserve any unrelated running processes.
4. Wait for each service to become ready. If a default port is occupied, allow the development server to choose or use an available port, then report the actual port it selected.
5. Verify the backend responds on its health or root endpoint and that the frontend dev server is reachable.
6. Respond with only a concise demo status summary containing:
   - Backend URL and port
   - Frontend URL and port
   - Whether each service is ready
   - Any setup issue that prevents the demo from running

Keep the processes running so the user can open the reported frontend URL. Do not stop them unless explicitly asked.
