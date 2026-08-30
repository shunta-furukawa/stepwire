import type { Metadata } from 'next';
import { SectionIndex } from '@/components/SectionIndex';
import { getSection } from '@/lib/content/categories';

const section = getSection('charts')!;

export const metadata: Metadata = {
  title: section.label,
  description: section.description,
  alternates: { canonical: '/charts' },
  openGraph: { title: section.label, description: section.description, url: '/charts' },
};

export default function Page() {
  return <SectionIndex slug="charts" />;
}
