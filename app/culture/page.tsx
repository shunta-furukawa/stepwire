import type { Metadata } from 'next';
import { SectionIndex } from '@/components/SectionIndex';
import { getSection } from '@/lib/content/categories';

const section = getSection('culture')!;

export const metadata: Metadata = {
  title: section.label,
  description: section.description,
  alternates: { canonical: '/culture' },
  openGraph: { title: section.label, description: section.description, url: '/culture' },
};

export default function Page() {
  return <SectionIndex slug="culture" />;
}
