// Prints strong random secrets for server/.env (and ai-service/.env).
//   npm run gen-secrets
import crypto from "node:crypto";

console.log(`# Paste into server/.env
JWT_ACCESS_SECRET=${crypto.randomBytes(48).toString("base64url")}
DATA_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}
AI_SERVICE_KEY=${crypto.randomBytes(48).toString("base64url")}

# The SAME AI_SERVICE_KEY must also go into ai-service/.env
# Back up DATA_ENCRYPTION_KEY safely - without it, saved reports can't be decrypted!`);
