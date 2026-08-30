import type { Metadata } from 'next';
import { SectionIndex } from '@/components/SectionIndex';
import { getSection } from '@/lib/content/categories';

const section = getSection('data')!;

export const metadata: Metadata = {
  title: section.label,
  description: section.description,
  alternates: { canonical: '/data' },
  openGraph: { title: section.label, description: section.description, url: '/data' },
};

export default function Page() {
  return <SectionIndex slug="data" />;
}
