import type { Metadata } from 'next';
import { SectionIndex } from '@/components/SectionIndex';
import { getSection } from '@/lib/content/categories';

const section = getSection('news')!;

export const metadata: Metadata = {
  title: section.label,
  description: section.description,
  alternates: { canonical: '/news' },
  openGraph: { title: section.label, description: section.description, url: '/news' },
};

export default function Page() {
  return <SectionIndex slug="news" />;
}
