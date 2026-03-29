import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

// --- Make sure your actual Worker URL is here! ---
const WORKER_URL = "https://zoho-ops-logger.arfilm47.workers.dev"; 

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // 1. ALWAYS log locally to your CMD/Terminal so you can see what is happening
  console.log(`${formattedTime} [${source}] ${message}`);

  // --- 🚨 STRICT FILTER 🚨 ---
  if (source !== 'job-logger') return; 
  if (!message.includes('Body Payload:')) return; 

  // 2. Send strictly formatted data to Cloudflare Worker
  if (WORKER_URL && WORKER_URL.startsWith('http')) {
      let parsedBody: any = {};
      let platform = "crm";
      let summaryText = "Bulk Job Started";

      try {
        if (message.includes('{') && message.includes('}')) {
          const jsonStart = message.indexOf('{');
          const jsonEnd = message.lastIndexOf('}') + 1;
          const fullBody = JSON.parse(message.slice(jsonStart, jsonEnd));

          platform = fullBody.platform || "crm";

          parsedBody = {
              emails: fullBody.emails,
              lastName: fullBody.lastName,
              subject: fullBody.subject,
              content: fullBody.content
          };

          // --- 🚨 NEW: FORMATTED PREVIEW SUMMARY 🚨 ---
          const emailCount = Array.isArray(fullBody.emails) ? fullBody.emails.length : 0;
          const subj = fullBody.subject || "No Subject";
          
          // Strip HTML tags and extra spaces from content just for the preview column
          let previewContent = (fullBody.content || "")
              .replace(/<[^>]*>?/gm, ' ') // Remove HTML
              .replace(/\s+/g, ' ')       // Remove extra line breaks/spaces
              .trim();
              
          if (previewContent.length > 55) previewContent = previewContent.substring(0, 55) + "...";

          summaryText = `[${emailCount} Emails] Subj: ${subj} | Content: ${previewContent}`;
        }
      } catch (e) {
         return; 
      }

      const formattedSource = platform === 'bigin' ? 'bigin-bulk' : 'crm-bulk';

      const workerPayload = {
          method: 'APP_INPUT',
          source: formattedSource,
          summary: summaryText, // Inject the new readable summary here
          body: parsedBody
      };

      fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workerPayload)
      }).catch((err) => {
        // Silently fail if worker is down
      });
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}