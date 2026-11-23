// @ts-ignore - api/_server.cjs is generated during Vercel buildCommand
import mod from './_server.cjs';

const app = mod.default || mod;

export default function handler(req, res) {
  return app(req, res);
}
