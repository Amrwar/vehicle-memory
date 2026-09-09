import { redirectToSurface } from '@/lib/guard';

export default async function Home() {
  await redirectToSurface();
}
