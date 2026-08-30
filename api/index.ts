import { createApiApp } from '../server/app';

const app = createApiApp();

export default async function handler(req: any, res: any) {
  app(req, res);
}
