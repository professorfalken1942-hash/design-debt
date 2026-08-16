import { app } from "../apps/api/src/app.js";

export default function handler(request: any, response: any) {
  return app(request, response);
}
